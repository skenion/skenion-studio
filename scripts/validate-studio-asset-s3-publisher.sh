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

write_stub_metadata() {
  local object_path="$1"
  local sha="$2"

  cat >"${object_path}.stub-metadata" <<EOF
sha256=${sha}
component=skenion-studio
artifact-set=web
studio-version=${version}
source-tag=${release_tag}
source-commit=1111111111111111111111111111111111111111
EOF
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

metadata_json_of() {
  local path="$1"
  python3 - "${path}.stub-metadata" <<'PY'
import json
import os
import sys

metadata_path = sys.argv[1]
metadata = {}
if os.path.isfile(metadata_path):
    with open(metadata_path, encoding="utf-8") as fh:
        for line in fh:
            key, _, value = line.rstrip("\n").partition("=")
            if key:
                metadata[key] = value
if os.environ.get("STUB_AWS_CORRUPT_SHA_ON_HEAD") == "1":
    metadata["sha256"] = "0000000000000000000000000000000000000000000000000000000000000000"
print(json.dumps(metadata, sort_keys=True))
PY
}

write_metadata_file() {
  local path="$1"
  local metadata="$2"

  : >"${path}.stub-metadata"
  IFS=',' read -r -a pairs <<<"${metadata}"
  for pair in "${pairs[@]}"; do
    if [[ -n "${pair}" ]]; then
      printf '%s\n' "${pair}" >>"${path}.stub-metadata"
    fi
  done
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

    case "${subcommand}" in
      head-object)
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

        printf '{"ContentLength":%s,"Metadata":%s}\n' "$(size_of "${path}")" "$(metadata_json_of "${path}")"
        ;;
      put-object)
        bucket=""
        key=""
        body=""
        metadata=""
        if_none_match=""
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
            --body)
              body="$2"
              shift 2
              ;;
            --metadata)
              metadata="$2"
              shift 2
              ;;
            --if-none-match)
              if_none_match="$2"
              shift 2
              ;;
            --content-type)
              shift 2
              ;;
            *)
              shift
              ;;
          esac
        done

        if [[ "${if_none_match}" != "*" ]]; then
          echo "put-object missing required --if-none-match '*'" >&2
          exit 2
        fi

        path="${root}/${bucket}/${key}"
        if [[ -f "${path}" ]]; then
          echo "An error occurred (PreconditionFailed) when calling the PutObject operation: At least one precondition failed" >&2
          exit 255
        fi

        mkdir -p "$(dirname "${path}")"
        command cp "${body}" "${path}"
        rm -f "${path}.stub-metadata"
        if [[ "${STUB_AWS_DROP_METADATA_ON_PUT:-}" != "1" ]]; then
          write_metadata_file "${path}" "${metadata}"
        fi
        echo "put ${bucket}/${key}" >>"${log}"
        ;;
      *)
        echo "unsupported aws s3api subcommand: ${subcommand}" >&2
        exit 2
        ;;
    esac
    ;;
  s3)
    echo "unsupported aws s3 command in Studio publisher" >&2
    exit 2
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
state_root="${STUB_CURL_STATE_DIR:?}"
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
mkdir -p "${state_root}"
counter_name="$(printf '%s' "${method}_${relative_key}" | tr -c '[:alnum:]' '_')"
counter_path="${state_root}/${counter_name}.count"
attempt=0
if [[ -f "${counter_path}" ]]; then
  attempt="$(sed -n '1p' "${counter_path}")"
fi
attempt=$((attempt + 1))
printf '%s\n' "${attempt}" >"${counter_path}"

fail_attempts=0
if [[ "${method}" == "HEAD" ]]; then
  fail_attempts="${STUB_CURL_FAIL_HEAD_ATTEMPTS:-0}"
else
  fail_attempts="${STUB_CURL_FAIL_GET_ATTEMPTS:-0}"
fi

if [[ "${attempt}" -le "${fail_attempts}" ]]; then
  echo "curl: (22) The requested URL returned error: 403" >&2
  exit 22
fi

if [[ "${method}" == "HEAD" ]]; then
  head_size="${size}"
  if [[ "${STUB_CURL_MISMATCH_WEB_ASSET_LENGTH:-}" == "1" && "${relative_key}" == *skenion-studio-web-bundle-*.tar.gz ]]; then
    head_size=$((size + 1))
  fi
  if [[ -n "${dump_header}" ]]; then
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${head_size}" >"${dump_header}"
  else
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${head_size}"
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
    "STUB_CURL_STATE_DIR=${case_dir}/curl-state"
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
    "SKENION_PUBLIC_VERIFY_ATTEMPTS=3"
    "SKENION_PUBLIC_VERIFY_SLEEP_SECONDS=0"
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

put_indexes = [
    (index, event.removeprefix("put "))
    for index, event in enumerate(events)
    if event.startswith("put ")
]
assert len(put_indexes) == 6, events
for index, key in put_indexes:
    assert any(event == f"head {key}" for event in events[:index]), (key, events)
PY

  grep -q '^HEAD skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log"
  grep -q '^GET skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log"
  grep -q '^GET skenion-studio/v1.2.3/web/skenion-studio-web-artifacts-v1.2.3\.index\.json$' "${case_dir}/curl.log"
}

assert_public_retry_case() {
  local case_dir="${tmp_root}/public-retry"
  local head_count
  local get_count

  prepare_case "${case_dir}" "studio public retry artifact"
  run_publisher "${case_dir}" STUB_CURL_FAIL_HEAD_ATTEMPTS=2 STUB_CURL_FAIL_GET_ATTEMPTS=2 >"${case_dir}/output.log" 2>&1

  grep -q 'public Studio release .*web bundle.* is not ready on attempt 1/3: HEAD request failed; retrying in 0s' "${case_dir}/output.log"
  grep -q 'public Studio release .*web bundle.* is not ready on attempt 2/3: HEAD request failed; retrying in 0s' "${case_dir}/output.log"
  grep -q 'public Studio release .*web bundle.* is not ready on attempt 1/3: GET request failed; retrying in 0s' "${case_dir}/output.log"
  grep -q 'public Studio release .*web bundle.* is not ready on attempt 2/3: GET request failed; retrying in 0s' "${case_dir}/output.log"

  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public web bundle HEAD to retry until third attempt, saw ${head_count}" >&2
    exit 1
  fi

  get_count="$(grep -c '^GET skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${get_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public web bundle GET to retry until third attempt, saw ${get_count}" >&2
    exit 1
  fi
}

assert_public_head_failure_case() {
  local case_dir="${tmp_root}/public-head-failure"
  local head_count

  prepare_case "${case_dir}" "studio public head failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_FAIL_HEAD_ATTEMPTS=3 >"${case_dir}/output.log" 2>&1; then
    echo "expected public HEAD verification case to fail" >&2
    exit 1
  fi

  grep -q 'failed to verify public Studio release .*web bundle' "${case_dir}/output.log"
  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public web bundle HEAD to fail after third attempt, saw ${head_count}" >&2
    exit 1
  fi
}

assert_public_get_failure_case() {
  local case_dir="${tmp_root}/public-get-failure"
  local get_count

  prepare_case "${case_dir}" "studio public get failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_FAIL_GET_ATTEMPTS=3 >"${case_dir}/output.log" 2>&1; then
    echo "expected public GET verification case to fail" >&2
    exit 1
  fi

  grep -q 'failed to download public Studio release .*web bundle' "${case_dir}/output.log"
  get_count="$(grep -c '^GET skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${get_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public web bundle GET to fail after third attempt, saw ${get_count}" >&2
    exit 1
  fi
}

assert_public_content_length_failure_case() {
  local case_dir="${tmp_root}/public-content-length-failure"
  local head_count

  prepare_case "${case_dir}" "studio public content length failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_MISMATCH_WEB_ASSET_LENGTH=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected public Content-Length verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio release .*web bundle.* Content-Length does not match local file' "${case_dir}/output.log"
  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public web bundle Content-Length mismatch to fail after third attempt, saw ${head_count}" >&2
    exit 1
  fi
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
  write_stub_metadata "${existing}" "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected no-clobber publisher case to fail" >&2
    exit 1
  fi

  grep -q 'refusing to overwrite existing Studio release artifact' "${case_dir}/output.log"
  if grep -q '^put ' "${case_dir}/aws.log"; then
    echo "publisher uploaded despite no-clobber refusal" >&2
    exit 1
  fi
}

assert_upload_missing_s3_metadata_is_not_a_failure_case() {
  local case_dir="${tmp_root}/upload-missing-s3-metadata"

  prepare_case "${case_dir}" "studio upload missing s3 metadata artifact"
  run_publisher "${case_dir}" STUB_AWS_DROP_METADATA_ON_PUT=1 >"${case_dir}/output.log" 2>&1

  grep -q 'uploaded Studio release object' "${case_dir}/output.log"
  if grep -q 'metadata does not match local file' "${case_dir}/output.log"; then
    echo "publisher required uploaded S3 metadata to round-trip" >&2
    exit 1
  fi
}

assert_existing_matching_metadata_skips_upload_case() {
  local case_dir="${tmp_root}/existing-matching-metadata"
  local web_asset_path
  local web_asset_name
  local web_asset_key
  local existing
  local expected_sha

  prepare_case "${case_dir}" "studio existing matching metadata artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  web_asset_name="$(basename "${web_asset_path}")"
  web_asset_key="${prefix}/skenion-studio/${release_tag}/web/${web_asset_name}"
  existing="${case_dir}/s3/${bucket}/${web_asset_key}"
  expected_sha="$(awk '{print $1; exit}' "${web_asset_path}.sha256")"
  mkdir -p "$(dirname "${existing}")"
  cp "${web_asset_path}" "${existing}"
  write_stub_metadata "${existing}" "${expected_sha}"

  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1

  grep -q 'object already exists and will not be overwritten' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${web_asset_key}$" "${case_dir}/aws.log"; then
    echo "publisher re-uploaded an existing object with matching metadata" >&2
    exit 1
  fi
}

assert_existing_missing_metadata_skips_matching_asset_case() {
  local case_dir="${tmp_root}/existing-missing-metadata"
  local web_asset_path
  local web_asset_name
  local web_asset_key
  local existing

  prepare_case "${case_dir}" "studio existing missing metadata artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  web_asset_name="$(basename "${web_asset_path}")"
  web_asset_key="${prefix}/skenion-studio/${release_tag}/web/${web_asset_name}"
  existing="${case_dir}/s3/${bucket}/${web_asset_key}"
  mkdir -p "$(dirname "${existing}")"
  cp "${web_asset_path}" "${existing}"

  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1

  grep -q 'object already exists without immutable metadata and matching size' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${web_asset_key}$" "${case_dir}/aws.log"; then
    echo "publisher re-uploaded an existing metadata-free object with matching size" >&2
    exit 1
  fi
}

assert_existing_missing_metadata_mismatched_size_case() {
  local case_dir="${tmp_root}/existing-missing-metadata-size-mismatch"
  local web_asset_path
  local web_asset_name
  local existing

  prepare_case "${case_dir}" "studio existing missing metadata size mismatch artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  web_asset_name="$(basename "${web_asset_path}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/web/${web_asset_name}"
  mkdir -p "$(dirname "${existing}")"
  printf 'size mismatch\n' >"${existing}"

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected existing missing metadata size mismatch case to fail" >&2
    exit 1
  fi

  grep -q 'existing S3 object size does not match expected artifact' "${case_dir}/output.log"
  if grep -q '^put ' "${case_dir}/aws.log"; then
    echo "publisher uploaded despite existing metadata-free size mismatch" >&2
    exit 1
  fi
}

assert_existing_mismatched_metadata_fails_case() {
  local case_dir="${tmp_root}/existing-mismatched-metadata"
  local web_asset_path
  local web_asset_name
  local existing

  prepare_case "${case_dir}" "studio existing mismatched metadata artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  web_asset_name="$(basename "${web_asset_path}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/web/${web_asset_name}"
  mkdir -p "$(dirname "${existing}")"
  cp "${web_asset_path}" "${existing}"
  write_stub_metadata "${existing}" "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected existing mismatched metadata case to fail" >&2
    exit 1
  fi

  grep -q 'S3 metadata does not match expected immutable artifact' "${case_dir}/output.log"
  if grep -q '^put ' "${case_dir}/aws.log"; then
    echo "publisher uploaded despite existing mismatched metadata" >&2
    exit 1
  fi
}

assert_existing_missing_metadata_mismatched_content_case() {
  local case_dir="${tmp_root}/existing-missing-metadata-content-mismatch"
  local web_asset_path
  local web_asset_name
  local web_asset_key
  local existing

  prepare_case "${case_dir}" "studio existing missing metadata content mismatch artifact"
  web_asset_path="$(web_asset_path_for "${case_dir}")"
  web_asset_name="$(basename "${web_asset_path}")"
  web_asset_key="${prefix}/skenion-studio/${release_tag}/web/${web_asset_name}"
  existing="${case_dir}/s3/${bucket}/${web_asset_key}"
  mkdir -p "$(dirname "${existing}")"
  cp "${web_asset_path}" "${existing}"
  printf 'X' | dd of="${existing}" bs=1 count=1 conv=notrunc >/dev/null 2>&1

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected existing missing metadata content mismatch case to fail" >&2
    exit 1
  fi

  grep -q 'object already exists without immutable metadata and matching size' "${case_dir}/output.log"
  grep -q 'public Studio release .*web bundle.* content does not match local file' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${web_asset_key}$" "${case_dir}/aws.log"; then
    echo "publisher overwrote metadata-free same-size object before public content verification" >&2
    exit 1
  fi
}

assert_public_content_failure_case() {
  local case_dir="${tmp_root}/public-content-failure"
  local get_count

  prepare_case "${case_dir}" "studio public content failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_CORRUPT_WEB_ASSET=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected public content verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio release .*web bundle.* content does not match local file' "${case_dir}/output.log"
  get_count="$(grep -c '^GET skenion-studio/v1.2.3/web/skenion-studio-web-bundle-v1.2.3\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${get_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public web bundle content mismatch to fail after third attempt, saw ${get_count}" >&2
    exit 1
  fi
}

install_stubs "${tmp_root}/bin"
assert_github_actions_guard_case
assert_success_case
assert_public_retry_case
assert_public_head_failure_case
assert_public_get_failure_case
assert_public_content_length_failure_case
assert_secretless_dry_run_defaults_case
assert_no_clobber_case
assert_upload_missing_s3_metadata_is_not_a_failure_case
assert_existing_matching_metadata_skips_upload_case
assert_existing_missing_metadata_skips_matching_asset_case
assert_existing_missing_metadata_mismatched_size_case
assert_existing_mismatched_metadata_fails_case
assert_existing_missing_metadata_mismatched_content_case
assert_public_content_failure_case

echo "Studio DSUB S3 publisher validation passed."
