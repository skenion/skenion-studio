#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
publisher="${repo_root}/scripts/publish-studio-asset-s3.sh"
tmp_root="$(mktemp -d)"
version="1.2.3"
release_tag="v1.2.3"
bucket="skenion"
prefix="releases"
public_base="https://cdn.example.test/skenion/releases"

cleanup() {
  rm -rf "${tmp_root}"
}
trap cleanup EXIT

write_checksum() {
  local asset="$1"
  local output="$2"

  if command -v sha256sum >/dev/null 2>&1; then
    (
      cd "$(dirname "${asset}")"
      sha256sum "$(basename "${asset}")" >"${output}"
    )
  elif command -v shasum >/dev/null 2>&1; then
    (
      cd "$(dirname "${asset}")"
      shasum -a 256 "$(basename "${asset}")" >"${output}"
    )
  else
    echo "no sha256 checksum tool found" >&2
    exit 1
  fi
}

install_stubs() {
  local bin_dir="$1"
  mkdir -p "${bin_dir}"

  cat >"${bin_dir}/aws" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

log="${STUB_AWS_LOG:?}"
root="${STUB_S3_ROOT:?}"

size_of() {
  wc -c <"$1" | tr -d '[:space:]'
}

metadata_sha_of() {
  local path="$1"
  if [[ -f "${path}.stub-sha256" ]]; then
    sed -n '1p' "${path}.stub-sha256"
  fi
}

if [[ "${1:-}" == "configure" ]]; then
  echo "configure $*" >>"${log}"
  exit 0
fi

if [[ "${1:-}" == "--endpoint-url" ]]; then
  shift 2
fi

command_name="${1:-}"
shift || true

case "${command_name}" in
  s3api)
    subcommand="${1:-}"
    shift || true
    if [[ "${subcommand}" != "head-object" ]]; then
      echo "unsupported aws s3api subcommand: ${subcommand}" >&2
      exit 2
    fi

    bucket=""
    key=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --bucket)
          bucket="$2"
          shift 2
          ;;
        --key)
          key="$2"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done

    echo "head ${bucket}/${key}" >>"${log}"
    path="${root}/${bucket}/${key}"
    if [[ ! -f "${path}" ]]; then
      echo "An error occurred (404) when calling the HeadObject operation: Not Found" >&2
      exit 255
    fi

    sha="$(metadata_sha_of "${path}")"
    if [[ "${STUB_AWS_CORRUPT_SHA_ON_HEAD:-}" == "1" ]]; then
      sha="0000000000000000000000000000000000000000000000000000000000000000"
    fi
    printf '{"ContentLength":%s,"Metadata":{"sha256":"%s"}}\n' "$(size_of "${path}")" "${sha}"
    ;;
  s3)
    subcommand="${1:-}"
    shift || true
    if [[ "${subcommand}" != "cp" ]]; then
      echo "unsupported aws s3 subcommand: ${subcommand}" >&2
      exit 2
    fi

    src="$1"
    dest="$2"
    shift 2
    metadata=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --metadata)
          metadata="$2"
          shift 2
          ;;
        --content-type)
          shift 2
          ;;
        --no-progress)
          shift
          ;;
        *)
          shift
          ;;
      esac
    done

    bucket_and_key="${dest#s3://}"
    bucket="${bucket_and_key%%/*}"
    key="${bucket_and_key#*/}"
    path="${root}/${bucket}/${key}"
    mkdir -p "$(dirname "${path}")"
    command cp "${src}" "${path}"

    sha=""
    IFS=',' read -r -a pairs <<<"${metadata}"
    for pair in "${pairs[@]}"; do
      if [[ "${pair}" == sha256=* ]]; then
        sha="${pair#sha256=}"
      fi
    done
    printf '%s\n' "${sha}" >"${path}.stub-sha256"
    echo "cp ${bucket}/${key}" >>"${log}"
    ;;
  *)
    echo "unsupported aws command: ${command_name}" >&2
    exit 2
    ;;
esac
BASH

  cat >"${bin_dir}/curl" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

log="${STUB_CURL_LOG:?}"
public_base="${STUB_PUBLIC_BASE_URL:?}"
public_root="${STUB_PUBLIC_ROOT:?}"
method="GET"
output=""
dump_header=""
url=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --head|-I)
      method="HEAD"
      shift
      ;;
    --output|-o)
      output="$2"
      shift 2
      ;;
    --dump-header|-D)
      dump_header="$2"
      shift 2
      ;;
    --fail|--silent|--show-error|--location|-f|-s|-S|-L)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done

if [[ "${url}" != "${public_base}/"* ]]; then
  echo "unexpected public URL: ${url}" >&2
  exit 2
fi

relative_key="${url#"${public_base}/"}"
path="${public_root}/${relative_key}"
if [[ ! -f "${path}" ]]; then
  echo "curl: (22) The requested URL returned error: 404" >&2
  exit 22
fi

echo "${method} ${relative_key}" >>"${log}"
size="$(wc -c <"${path}" | tr -d '[:space:]')"

if [[ "${method}" == "HEAD" ]]; then
  if [[ -n "${dump_header}" ]]; then
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${size}" >"${dump_header}"
  else
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${size}"
  fi
  exit 0
fi

if [[ "${STUB_CURL_CORRUPT_WEB_ASSET:-}" == "1" && "${relative_key}" == *skenion-studio-web-bundle-*.tar.gz ]]; then
  body="corrupt web asset response"
  if [[ -n "${output}" ]]; then
    printf '%s\n' "${body}" >"${output}"
  else
    printf '%s\n' "${body}"
  fi
  exit 0
fi

if [[ -n "${output}" ]]; then
  command cp "${path}" "${output}"
else
  cat "${path}"
fi
BASH

  chmod +x "${bin_dir}/aws" "${bin_dir}/curl"
}

prepare_case() {
  local case_dir="$1"
  local content="$2"
  local asset_dir="${case_dir}/dist"
  local web_asset_path="${asset_dir}/skenion-studio-web-bundle-v${version}.tar.gz"
  local desktop_manifest_path="${asset_dir}/skenion-studio-desktop-manifest-v${version}.json"
  local combined_checksum_path="${asset_dir}/skenion-studio-release-artifacts-v${version}.sha256"

  mkdir -p "${asset_dir}"
  printf '%s\n' "${content}" >"${web_asset_path}"
  printf '{"schema-version":"0.1","component":"studio-desktop","version":"%s"}\n' "${version}" >"${desktop_manifest_path}"
  write_checksum "${web_asset_path}" "${web_asset_path}.sha256"
  write_checksum "${desktop_manifest_path}" "${desktop_manifest_path}.sha256"
  (
    cd "${asset_dir}"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$(basename "${web_asset_path}")" "$(basename "${desktop_manifest_path}")" >"${combined_checksum_path}"
    else
      shasum -a 256 "$(basename "${web_asset_path}")" "$(basename "${desktop_manifest_path}")" >"${combined_checksum_path}"
    fi
  )
}

asset_dir_for() {
  local case_dir="$1"
  printf '%s/dist' "${case_dir}"
}

web_asset_path_for() {
  local case_dir="$1"
  printf '%s/skenion-studio-web-bundle-v%s.tar.gz' "$(asset_dir_for "${case_dir}")" "${version}"
}

desktop_manifest_path_for() {
  local case_dir="$1"
  printf '%s/skenion-studio-desktop-manifest-v%s.json' "$(asset_dir_for "${case_dir}")" "${version}"
}

combined_checksum_path_for() {
  local case_dir="$1"
  printf '%s/skenion-studio-release-artifacts-v%s.sha256' "$(asset_dir_for "${case_dir}")" "${version}"
}

run_publisher() {
  local case_dir="$1"
  local web_asset_path
  local desktop_manifest_path
  local combined_checksum_path
  local -a base_env
  shift

  mkdir -p "${case_dir}/s3/${bucket}/${prefix}"
  : >"${case_dir}/aws.log"
  : >"${case_dir}/curl.log"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  desktop_manifest_path="$(desktop_manifest_path_for "${case_dir}")"
  combined_checksum_path="$(combined_checksum_path_for "${case_dir}")"

  base_env=(
    "PATH=${tmp_root}/bin:${PATH}"
    "STUB_AWS_LOG=${case_dir}/aws.log"
    "STUB_CURL_LOG=${case_dir}/curl.log"
    "STUB_S3_ROOT=${case_dir}/s3"
    "STUB_PUBLIC_BASE_URL=${public_base}"
    "STUB_PUBLIC_ROOT=${case_dir}/s3/${bucket}/${prefix}"
    "GITHUB_ACTIONS=true"
    "GITHUB_EVENT_NAME=workflow_dispatch"
    "SKENION_RELEASE_S3_ENDPOINT=https://s3.example.test"
    "SKENION_RELEASE_S3_REGION=us-east-1"
    "SKENION_RELEASE_S3_BUCKET=${bucket}"
    "SKENION_RELEASE_S3_PREFIX=${prefix}"
    "SKENION_RELEASE_S3_ACCESS_KEY_ID=test-access-key"
    "SKENION_RELEASE_S3_SECRET_ACCESS_KEY=test-secret-key"
    "SKENION_RELEASE_S3_FORCE_PATH_STYLE=true"
    "SKENION_RELEASE_PUBLIC_BASE_URL=${public_base}"
    "SOURCE_COMMIT=1111111111111111111111111111111111111111"
    "CONTRACTS_VERSION=1.2.0"
    "CONTRACTS_LINE=1.2"
    "CONTRACTS_RANGE=>=1.2.0 <1.3.0"
    "RUNTIME_TAG=v1.2.0"
  )

  env "${base_env[@]}" \
    "${publisher}" \
    --dry-run \
    "${version}" \
    "${release_tag}" \
    "${web_asset_path}" \
    "${web_asset_path}.sha256" \
    "${desktop_manifest_path}" \
    "${desktop_manifest_path}.sha256" \
    "${combined_checksum_path}" >/dev/null

  env "${base_env[@]}" \
    "$@" \
    "${publisher}" \
    --use-existing-manifest \
    "${version}" \
    "${release_tag}" \
    "${web_asset_path}" \
    "${web_asset_path}.sha256" \
    "${desktop_manifest_path}" \
    "${desktop_manifest_path}.sha256" \
    "${combined_checksum_path}"
}

assert_github_actions_guard_case() {
  local case_dir="${tmp_root}/github-actions-guard"

  prepare_case "${case_dir}" "studio github actions guard artifact"
  if run_publisher "${case_dir}" GITHUB_ACTIONS= GITHUB_EVENT_NAME=push >"${case_dir}/output.log" 2>&1; then
    echo "expected GitHub Actions guard publisher case to fail" >&2
    exit 1
  fi

  grep -q 'Studio release artifact publishing must run from GitHub Actions' "${case_dir}/output.log"
  if [[ -s "${case_dir}/aws.log" ]]; then
    echo "publisher reached S3 stub despite GitHub Actions guard refusal" >&2
    exit 1
  fi
}

assert_success_case() {
  local case_dir="${tmp_root}/success"
  local index_path

  prepare_case "${case_dir}" "studio success artifact"
  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1
  index_path="$(asset_dir_for "${case_dir}")/skenion-studio-web-artifacts-v${version}.index.json"

  python3 - "${index_path}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    index = json.load(fh)

assert index["schema"] == "skenion.studio.webArtifacts.v1"
assert index["component"] == "skenion-studio"
assert index["studioVersion"] == "1.2.3"
assert index["releaseTag"] == "v1.2.3"
assert index["runtime"]["binarySource"] == "skenion-runtime-release-manifest"
assert index["runtime"]["bundledByStudioWebArtifacts"] is False
assert index["distribution"]["storage"] == "dsub-s3"
assert index["assets"][0]["role"] == "web-bundle"
assert index["assets"][0]["s3"]["bucket"] == "skenion"
assert index["assets"][0]["publicUrl"].startswith("https://cdn.example.test/skenion/releases/")
assert index["assets"][2]["role"] == "desktop-manifest"
assert index["assets"][4]["role"] == "combined-checksum"
assert index["index"]["publicUrl"].endswith(".index.json")
PY

  python3 - "${case_dir}/aws.log" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    events = [line.strip() for line in fh if line.strip()]

cp_indexes = [
    (index, event.removeprefix("cp "))
    for index, event in enumerate(events)
    if event.startswith("cp ")
]
assert len(cp_indexes) == 6, events
for index, key in cp_indexes:
    assert any(event == f"head {key}" for event in events[index + 1 :]), (key, events)
PY

  grep -q '^HEAD skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log"
  grep -q '^GET skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log"
  grep -q '^GET skenion-studio/v1.2.3/web/skenion-studio-web-artifacts-v1.2.3\.index\.json$' "${case_dir}/curl.log"
}

assert_secretless_dry_run_defaults_case() {
  local case_dir="${tmp_root}/secretless-dry-run"
  local web_asset_path
  local desktop_manifest_path
  local combined_checksum_path
  local index_path

  prepare_case "${case_dir}" "studio secretless dry-run artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  desktop_manifest_path="$(desktop_manifest_path_for "${case_dir}")"
  combined_checksum_path="$(combined_checksum_path_for "${case_dir}")"
  index_path="$(asset_dir_for "${case_dir}")/skenion-studio-web-artifacts-v${version}.index.json"

  env -i \
    "PATH=${PATH}" \
    "SOURCE_COMMIT=2222222222222222222222222222222222222222" \
    "CONTRACTS_VERSION=1.2.0" \
    "CONTRACTS_LINE=1.2" \
    "CONTRACTS_RANGE=>=1.2.0 <1.3.0" \
    "RUNTIME_TAG=v1.2.0" \
    "${publisher}" \
    --dry-run \
    "${version}" \
    "${release_tag}" \
    "${web_asset_path}" \
    "${web_asset_path}.sha256" \
    "${desktop_manifest_path}" \
    "${desktop_manifest_path}.sha256" \
    "${combined_checksum_path}" >"${case_dir}/output.log"

  python3 - "${index_path}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    index = json.load(fh)

assert index["schema"] == "skenion.studio.webArtifacts.v1"
assert index["component"] == "skenion-studio"
assert index["studioVersion"] == "1.2.3"
assert index["releaseTag"] == "v1.2.3"
assert index["sourceCommit"] == "2222222222222222222222222222222222222222"
assert index["distribution"]["storage"] == "dsub-s3"
assert index["distribution"]["publicBaseUrl"] == "https://cdn.dsub.io/skenion/releases"
assert index["assets"][0]["s3"]["bucket"] == "skenion"
assert index["assets"][0]["s3"]["key"] == "releases/skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3.tar.gz"
assert index["assets"][0]["publicUrl"] == "https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3.tar.gz"
assert index["index"]["s3"]["bucket"] == "skenion"
assert index["index"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/web/skenion-studio-web-artifacts-v1.2.3.index.json"
assert index["index"]["publicUrl"] == "https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/web/skenion-studio-web-artifacts-v1.2.3.index.json"
PY

  grep -q 'dry run: would publish Studio web bundle to https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3.tar.gz' "${case_dir}/output.log"
}

assert_no_clobber_case() {
  local case_dir="${tmp_root}/no-clobber"
  local web_asset_path
  local web_asset_name
  local existing

  prepare_case "${case_dir}" "studio no-clobber artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  web_asset_name="$(basename "${web_asset_path}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/web/${web_asset_name}"
  mkdir -p "$(dirname "${existing}")"
  printf 'different existing asset\n' >"${existing}"
  printf 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\n' >"${existing}.stub-sha256"

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected no-clobber publisher case to fail" >&2
    exit 1
  fi

  grep -q 'refusing to overwrite existing Studio release artifact' "${case_dir}/output.log"
  if grep -q '^cp ' "${case_dir}/aws.log"; then
    echo "publisher uploaded despite no-clobber refusal" >&2
    exit 1
  fi
}

assert_uploaded_metadata_failure_case() {
  local case_dir="${tmp_root}/metadata-failure"

  prepare_case "${case_dir}" "studio metadata failure artifact"
  if run_publisher "${case_dir}" STUB_AWS_CORRUPT_SHA_ON_HEAD=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected uploaded metadata verification case to fail" >&2
    exit 1
  fi

  grep -q 'uploaded Studio release .* metadata does not match local file' "${case_dir}/output.log"
}

assert_public_content_failure_case() {
  local case_dir="${tmp_root}/public-content-failure"

  prepare_case "${case_dir}" "studio public content failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_CORRUPT_WEB_ASSET=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected public content verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio release .*web bundle.* content does not match local file' "${case_dir}/output.log"
}

install_stubs "${tmp_root}/bin"
assert_github_actions_guard_case
assert_success_case
assert_secretless_dry_run_defaults_case
assert_no_clobber_case
assert_uploaded_metadata_failure_case
assert_public_content_failure_case

echo "Studio DSUB S3 publisher validation passed."
