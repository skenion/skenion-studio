#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
publisher="${repo_root}/scripts/publish-studio-desktop-asset-s3.sh"
tmp_root="$(mktemp -d)"
version="1.2.3"
release_tag="v1.2.3"
target="x86_64-unknown-linux-gnu"
tier="release-blocking"
bucket="skenion"
prefix="releases"
public_base="https://cdn.example.test/skenion/releases"
package_id="linux-x64-deb"

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

sha_of() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${path}" | awk '{print $1}'
  else
    shasum -a 256 "${path}" | awk '{print $1}'
  fi
}

size_of() {
  wc -c <"$1" | tr -d '[:space:]'
}

write_stub_metadata() {
  local object_path="$1"
  local sha="$2"

  cat >"${object_path}.stub-metadata" <<EOF
sha256=${sha}
component=skenion-studio
artifact-set=desktop
studio-version=${version}
source-tag=${release_tag}
source-commit=1111111111111111111111111111111111111111
package-id=${package_id}
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
        if [[ "${STUB_AWS_HEAD_FORBIDDEN:-}" == "1" ]]; then
          echo "An error occurred (403) when calling the HeadObject operation: Forbidden" >&2
          exit 255
        fi
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
    echo "unsupported aws s3 command in Studio desktop publisher" >&2
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

if [[ "${STUB_CURL_FAIL:-}" == "1" ]]; then
  echo "curl: (22) The requested URL returned error: 403" >&2
  exit 22
fi

if [[ "${method}" == "HEAD" ]]; then
  head_size="${size}"
  if [[ "${STUB_CURL_MISMATCH_INSTALLER_LENGTH:-}" == "1" && "${relative_key}" == *"/desktop/linux-x64-deb/"*"v1.2.3-linux-x64.deb" ]]; then
    head_size=$((size + 1))
  fi
  if [[ -n "${dump_header}" ]]; then
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${head_size}" >"${dump_header}"
  else
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${head_size}"
  fi
  exit 0
fi

if [[ "${STUB_CURL_CORRUPT_INSTALLER:-}" == "1" && "${relative_key}" == *"/desktop/linux-x64-deb/"*"v1.2.3-linux-x64.deb" ]]; then
  body="corrupt desktop installer response"
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
  local asset_path="${asset_dir}/skenion-studio-v${version}-linux-x64.deb"
  local checksum_path="${asset_path}.sha256"
  local manifest_path="${asset_dir}/installers.json"
  local sha
  local size

  mkdir -p "${asset_dir}"
  printf '%s\n' "${content}" >"${asset_path}"
  write_checksum "${asset_path}" "${checksum_path}"
  sha="$(sha_of "${asset_path}")"
  size="$(size_of "${asset_path}")"

  python3 - "${manifest_path}" "${asset_path}" "${checksum_path}" "${sha}" "${size}" <<'PY'
import json
import sys

manifest_path, asset_path, checksum_path, sha, size = sys.argv[1:6]
manifest = {
    "schema": "skenion.studio.desktopInstallers.v1",
    "component": "skenion-studio",
    "studioVersion": "1.2.3",
    "target": "x86_64-unknown-linux-gnu",
    "installers": [
        {
            "packageId": "linux-x64-deb",
            "family": "deb",
            "filename": "skenion-studio-v1.2.3-linux-x64.deb",
            "path": asset_path,
            "checksumFilename": "skenion-studio-v1.2.3-linux-x64.deb.sha256",
            "checksumPath": checksum_path,
            "sha256": sha,
            "size": int(size),
            "sourceRelativePath": "deb/skenion-studio.deb",
        }
    ],
}
with open(manifest_path, "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY
}

asset_dir_for() {
  local case_dir="$1"
  printf '%s/dist' "${case_dir}"
}

asset_path_for() {
  local case_dir="$1"
  printf '%s/skenion-studio-v%s-linux-x64.deb' "$(asset_dir_for "${case_dir}")" "${version}"
}

manifest_path_for() {
  local case_dir="$1"
  printf '%s/installers.json' "$(asset_dir_for "${case_dir}")"
}

run_publisher() {
  local case_dir="$1"
  local -a base_env
  shift

  mkdir -p "${case_dir}/s3/${bucket}/${prefix}"
  : >"${case_dir}/aws.log"
  : >"${case_dir}/curl.log"

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
    "DESKTOP_SIGNING_MODE=unsigned-preview"
  )

  env "${base_env[@]}" \
    "$@" \
    "${publisher}" \
    "${version}" \
    "${release_tag}" \
    "${target}" \
    "${tier}" \
    "$(manifest_path_for "${case_dir}")"
}

assert_github_actions_guard_case() {
  local case_dir="${tmp_root}/github-actions-guard"

  prepare_case "${case_dir}" "studio desktop github actions guard installer"
  if run_publisher "${case_dir}" GITHUB_ACTIONS= GITHUB_EVENT_NAME=push >"${case_dir}/output.log" 2>&1; then
    echo "expected GitHub Actions guard publisher case to fail" >&2
    exit 1
  fi

  grep -q 'Studio desktop artifact publishing must run from GitHub Actions' "${case_dir}/output.log"
  if [[ -s "${case_dir}/aws.log" ]]; then
    echo "publisher reached S3 stub despite GitHub Actions guard refusal" >&2
    exit 1
  fi
}

assert_github_event_allowlist_case() {
  local dispatch_case_dir="${tmp_root}/github-event-repository-dispatch"
  local push_case_dir="${tmp_root}/github-event-push"

  prepare_case "${dispatch_case_dir}" "studio desktop repository dispatch event installer"
  run_publisher "${dispatch_case_dir}" GITHUB_EVENT_NAME=repository_dispatch >"${dispatch_case_dir}/output.log" 2>&1
  grep -q 'uploaded Studio desktop release object' "${dispatch_case_dir}/output.log"

  prepare_case "${push_case_dir}" "studio desktop push event installer"
  if run_publisher "${push_case_dir}" GITHUB_EVENT_NAME=push >"${push_case_dir}/output.log" 2>&1; then
    echo "expected GitHub push event desktop publisher case to fail" >&2
    exit 1
  fi

  grep -q 'only allowed for workflow_dispatch or repository_dispatch events' "${push_case_dir}/output.log"
  if grep -q '^put ' "${push_case_dir}/aws.log"; then
    echo "desktop publisher reached S3 stub despite GitHub event guard refusal" >&2
    exit 1
  fi
}

assert_success_case() {
  local case_dir="${tmp_root}/success"
  local index_path

  prepare_case "${case_dir}" "studio desktop success installer"
  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1
  index_path="$(asset_dir_for "${case_dir}")/skenion-studio-desktop-linux-x64-deb-v${version}.index.json"

  python3 - "${index_path}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    index = json.load(fh)

assert index["schema"] == "skenion.studio.desktopPackage.v1"
assert index["component"] == "skenion-studio"
assert index["studioVersion"] == "1.2.3"
assert index["releaseTag"] == "v1.2.3"
assert index["packageId"] == "linux-x64-deb"
assert index["family"] == "deb"
assert index["tier"] == "release-blocking"
assert index["runtime"]["releaseTag"] == "v1.2.0"
assert index["runtime"]["binarySource"] == "skenion-runtime-release-manifest"
assert index["signing"]["mode"] == "unsigned-preview"
assert index["distribution"]["storage"] == "dsub-s3"
assert index["desktopInstaller"]["s3"]["bucket"] == "skenion"
assert index["desktopInstaller"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1.2.3-linux-x64.deb"
assert index["desktopInstaller"]["publicUrl"] == "https://cdn.example.test/skenion/releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1.2.3-linux-x64.deb"
assert index["checksum"]["filename"] == "skenion-studio-v1.2.3-linux-x64.deb.sha256"
assert index["index"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-desktop-linux-x64-deb-v1.2.3.index.json"
assert index["index"]["publicUrl"].endswith("/desktop/linux-x64-deb/skenion-studio-desktop-linux-x64-deb-v1.2.3.index.json")
assert "unknown-linux-gnu" not in json.dumps(index)
PY

  python3 - "${case_dir}/aws.log" <<'PY'
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    events = [line.strip() for line in fh if line.strip()]

heads = [(index, event.removeprefix("head ")) for index, event in enumerate(events) if event.startswith("head ")]
puts = [(index, event.removeprefix("put ")) for index, event in enumerate(events) if event.startswith("put ")]
assert len(heads) == 3, events
assert len(puts) == 3, events
for index, key in puts:
    assert any(event == f"head {key}" for event in events[:index]), (key, events)
assert all("unknown-linux-gnu" not in event for event in events), events
PY

  grep -q 'public CDN verification skipped by default after successful DSUB S3 upload' "${case_dir}/output.log"
  if [[ -s "${case_dir}/curl.log" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "desktop publisher should skip public CDN curl checks by default" >&2
    exit 1
  fi
}

assert_windows_crlf_manifest_rows_case() {
  local case_dir="${tmp_root}/windows-crlf-manifest-rows"

  prepare_case "${case_dir}" "studio desktop windows crlf manifest row installer"
  run_publisher "${case_dir}" SKENION_TEST_STUDIO_DESKTOP_INSTALLER_ROWS_CRLF=1 >"${case_dir}/output.log" 2>&1

  grep -q 'uploaded Studio desktop release object' "${case_dir}/output.log"
  if grep -q 'installer manifest sha256 .* does not match' "${case_dir}/output.log"; then
    echo "publisher treated a CRLF-terminated installer manifest row as a checksum mismatch" >&2
    exit 1
  fi
}

assert_secretless_dry_run_defaults_case() {
  local case_dir="${tmp_root}/secretless-dry-run"
  local index_path

  prepare_case "${case_dir}" "studio desktop secretless dry-run installer"
  index_path="$(asset_dir_for "${case_dir}")/skenion-studio-desktop-linux-x64-deb-v${version}.index.json"

  env -i \
    "PATH=${PATH}" \
    "SOURCE_COMMIT=2222222222222222222222222222222222222222" \
    "CONTRACTS_VERSION=1.2.0" \
    "CONTRACTS_LINE=1.2" \
    "CONTRACTS_RANGE=>=1.2.0 <1.3.0" \
    "RUNTIME_TAG=v1.2.0" \
    "DESKTOP_SIGNING_MODE=unsigned-preview" \
    "${publisher}" \
    --dry-run \
    "${version}" \
    "${release_tag}" \
    "${target}" \
    "${tier}" \
    "$(manifest_path_for "${case_dir}")" >"${case_dir}/output.log"

  python3 - "${index_path}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    index = json.load(fh)

assert index["sourceCommit"] == "2222222222222222222222222222222222222222"
assert index["distribution"]["publicBaseUrl"] == "https://cdn.dsub.io/skenion/releases"
assert index["desktopInstaller"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1.2.3-linux-x64.deb"
assert index["desktopInstaller"]["publicUrl"] == "https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1.2.3-linux-x64.deb"
assert index["checksum"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1.2.3-linux-x64.deb.sha256"
assert index["index"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-desktop-linux-x64-deb-v1.2.3.index.json"
PY

  grep -q 'dry run: would publish Studio desktop installer to https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1.2.3-linux-x64.deb' "${case_dir}/output.log"
}

assert_no_clobber_case() {
  local case_dir="${tmp_root}/no-clobber"
  local asset_path
  local existing

  prepare_case "${case_dir}" "studio desktop no-clobber installer"
  asset_path="$(asset_path_for "${case_dir}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/$(basename "${asset_path}")"
  mkdir -p "$(dirname "${existing}")"
  printf 'different existing installer\n' >"${existing}"
  write_stub_metadata "${existing}" "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected no-clobber publisher case to fail when HeadObject metadata mismatches" >&2
    exit 1
  fi

  grep -q 'refusing to overwrite existing Studio desktop release artifact' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/$(basename "${asset_path}")$" "${case_dir}/aws.log"; then
    echo "publisher uploaded despite no-clobber refusal" >&2
    exit 1
  fi
}

assert_existing_matching_metadata_skips_upload_case() {
  local case_dir="${tmp_root}/existing-matching-metadata"
  local asset_path
  local asset_key
  local existing
  local expected_sha

  prepare_case "${case_dir}" "studio desktop existing matching metadata installer"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_key="${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/$(basename "${asset_path}")"
  existing="${case_dir}/s3/${bucket}/${asset_key}"
  expected_sha="$(awk '{print $1; exit}' "${asset_path}.sha256")"
  mkdir -p "$(dirname "${existing}")"
  cp "${asset_path}" "${existing}"
  write_stub_metadata "${existing}" "${expected_sha}"

  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1

  grep -q 'object already exists and will not be overwritten' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${asset_key}$" "${case_dir}/aws.log"; then
    echo "publisher re-uploaded an existing object with matching metadata" >&2
    exit 1
  fi
}

assert_existing_missing_metadata_matching_size_reuses_case() {
  local case_dir="${tmp_root}/existing-missing-metadata"
  local asset_path
  local existing

  prepare_case "${case_dir}" "studio desktop existing missing metadata installer"
  asset_path="$(asset_path_for "${case_dir}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/$(basename "${asset_path}")"
  mkdir -p "$(dirname "${existing}")"
  cp "${asset_path}" "${existing}"

  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1

  grep -q 'object already exists without immutable metadata and matching size' "${case_dir}/output.log"
  grep -q 'object already exists and will not be overwritten' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/$(basename "${asset_path}")$" "${case_dir}/aws.log"; then
    echo "publisher uploaded despite metadata-free existing desktop object refusal" >&2
    exit 1
  fi
}

assert_head_403_upload_succeeds_case() {
  local case_dir="${tmp_root}/head-403-upload-succeeds"

  prepare_case "${case_dir}" "studio desktop head 403 upload succeeds installer"
  run_publisher "${case_dir}" STUB_AWS_HEAD_FORBIDDEN=1 >"${case_dir}/output.log" 2>&1

  grep -q 'proceeding with conditional no-overwrite upload' "${case_dir}/output.log"
  grep -q 'uploaded Studio desktop release object' "${case_dir}/output.log"
  if ! grep -q '^put ' "${case_dir}/aws.log"; then
    echo "desktop publisher did not conditionally upload after HeadObject 403" >&2
    exit 1
  fi
}

assert_head_403_precondition_reuses_case() {
  local case_dir="${tmp_root}/head-403-precondition-reuses"
  local asset_path
  local asset_key
  local existing

  prepare_case "${case_dir}" "studio desktop head 403 precondition installer"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_key="${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/$(basename "${asset_path}")"
  existing="${case_dir}/s3/${bucket}/${asset_key}"
  mkdir -p "$(dirname "${existing}")"
  printf 'existing remote installer\n' >"${existing}"

  run_publisher "${case_dir}" STUB_AWS_HEAD_FORBIDDEN=1 >"${case_dir}/output.log" 2>&1

  grep -q 'proceeding with conditional no-overwrite upload' "${case_dir}/output.log"
  grep -q 'object already exists and will not be overwritten' "${case_dir}/output.log"
  grep -q 'without requiring HeadObject permission' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${asset_key}$" "${case_dir}/aws.log"; then
    echo "desktop publisher overwrote existing object after HeadObject 403" >&2
    exit 1
  fi
}

assert_strict_public_content_length_failure_case() {
  local case_dir="${tmp_root}/strict-public-content-length-failure"

  prepare_case "${case_dir}" "studio desktop strict public content length failure installer"
  if run_publisher "${case_dir}" SKENION_STRICT_PUBLIC_CDN_VERIFY=true STUB_CURL_MISMATCH_INSTALLER_LENGTH=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected strict public desktop Content-Length verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio desktop release .*desktop installer.* Content-Length does not match local file' "${case_dir}/output.log"
  grep -q '^HEAD skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1\.2\.3-linux-x64\.deb$' "${case_dir}/curl.log"
}

assert_strict_public_content_failure_case() {
  local case_dir="${tmp_root}/strict-public-content-failure"

  prepare_case "${case_dir}" "studio desktop strict public content failure installer"
  if run_publisher "${case_dir}" SKENION_STRICT_PUBLIC_CDN_VERIFY=true STUB_CURL_CORRUPT_INSTALLER=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected strict public content verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio desktop release .*desktop installer.* content does not match local file' "${case_dir}/output.log"
  grep -q '^GET skenion-studio/v1.2.3/desktop/linux-x64-deb/skenion-studio-v1\.2\.3-linux-x64\.deb$' "${case_dir}/curl.log"
}

install_stubs "${tmp_root}/bin"
assert_github_actions_guard_case
assert_github_event_allowlist_case
assert_success_case
assert_windows_crlf_manifest_rows_case
assert_secretless_dry_run_defaults_case
assert_no_clobber_case
assert_existing_matching_metadata_skips_upload_case
assert_existing_missing_metadata_matching_size_reuses_case
assert_head_403_upload_succeeds_case
assert_head_403_precondition_reuses_case
assert_strict_public_content_length_failure_case
assert_strict_public_content_failure_case

echo "Studio desktop DSUB S3 publisher validation passed."
