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
artifact-set=desktop
studio-version=${version}
source-tag=${release_tag}
source-commit=1111111111111111111111111111111111111111
target=${target}
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
fail_relative_key=""
if [[ "${method}" == "HEAD" ]]; then
  fail_attempts="${STUB_CURL_FAIL_HEAD_ATTEMPTS:-0}"
  fail_relative_key="${STUB_CURL_FAIL_HEAD_RELATIVE_KEY:-}"
else
  fail_attempts="${STUB_CURL_FAIL_GET_ATTEMPTS:-0}"
  fail_relative_key="${STUB_CURL_FAIL_GET_RELATIVE_KEY:-}"
fi

if [[ -n "${fail_relative_key}" && "${relative_key}" != "${fail_relative_key}" ]]; then
  fail_attempts=0
fi

if [[ "${attempt}" -le "${fail_attempts}" ]]; then
  echo "curl: (22) The requested URL returned error: 403" >&2
  exit 22
fi

if [[ "${method}" == "HEAD" ]]; then
  head_size="${size}"
  if [[ "${STUB_CURL_MISMATCH_DESKTOP_ASSET_LENGTH:-}" == "1" && "${relative_key}" == *"/desktop/"*"/skenion-studio-"*.tar.gz ]]; then
    head_size=$((size + 1))
  fi
  if [[ -n "${dump_header}" ]]; then
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${head_size}" >"${dump_header}"
  else
    printf 'HTTP/1.1 200 OK\r\nContent-Length: %s\r\n\r\n' "${head_size}"
  fi
  exit 0
fi

if [[ "${STUB_CURL_CORRUPT_DESKTOP_ASSET:-}" == "1" && "${relative_key}" == *"/desktop/"*"/skenion-studio-"*.tar.gz ]]; then
  body="corrupt desktop asset response"
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

  cat >"${bin_dir}/sleep" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${STUB_SLEEP_LOG:-}" ]]; then
  printf 'sleep %s\n' "$*" >>"${STUB_SLEEP_LOG}"
fi
BASH

  chmod +x "${bin_dir}/aws" "${bin_dir}/curl" "${bin_dir}/sleep"
}

prepare_case() {
  local case_dir="$1"
  local content="$2"
  local asset_dir="${case_dir}/dist"
  local asset_path="${asset_dir}/skenion-studio-${target}.tar.gz"

  mkdir -p "${asset_dir}"
  printf '%s\n' "${content}" >"${asset_path}"
  write_checksum "${asset_path}" "${asset_path}.sha256"
}

asset_dir_for() {
  local case_dir="$1"
  printf '%s/dist' "${case_dir}"
}

asset_path_for() {
  local case_dir="$1"
  printf '%s/skenion-studio-%s.tar.gz' "$(asset_dir_for "${case_dir}")" "${target}"
}

run_publisher() {
  local case_dir="$1"
  local asset_path
  local -a base_env
  shift

  mkdir -p "${case_dir}/s3/${bucket}/${prefix}"
  : >"${case_dir}/aws.log"
  : >"${case_dir}/curl.log"
  : >"${case_dir}/sleep.log"
  asset_path="$(asset_path_for "${case_dir}")"

  base_env=(
    "PATH=${tmp_root}/bin:${PATH}"
    "STUB_AWS_LOG=${case_dir}/aws.log"
    "STUB_CURL_LOG=${case_dir}/curl.log"
    "STUB_SLEEP_LOG=${case_dir}/sleep.log"
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
    "DESKTOP_SIGNING_MODE=unsigned-preview"
  )

  env "${base_env[@]}" \
    "$@" \
    "${publisher}" \
    "${version}" \
    "${release_tag}" \
    "${target}" \
    "${tier}" \
    "${asset_path}" \
    "${asset_path}.sha256"
}

assert_github_actions_guard_case() {
  local case_dir="${tmp_root}/github-actions-guard"

  prepare_case "${case_dir}" "studio desktop github actions guard artifact"
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

assert_success_case() {
  local case_dir="${tmp_root}/success"
  local index_path

  prepare_case "${case_dir}" "studio desktop success artifact"
  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1
  index_path="$(asset_dir_for "${case_dir}")/skenion-studio-desktop-${target}-v${version}.index.json"

  python3 - "${index_path}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    index = json.load(fh)

assert index["schema"] == "skenion.studio.desktopPackage.v1"
assert index["component"] == "skenion-studio"
assert index["studioVersion"] == "1.2.3"
assert index["releaseTag"] == "v1.2.3"
assert index["target"] == "x86_64-unknown-linux-gnu"
assert index["tier"] == "release-blocking"
assert index["runtime"]["releaseTag"] == "v1.2.0"
assert index["runtime"]["binarySource"] == "skenion-runtime-release-manifest"
assert index["signing"]["mode"] == "unsigned-preview"
assert index["distribution"]["storage"] == "dsub-s3"
assert index["desktopPackage"]["s3"]["bucket"] == "skenion"
assert index["desktopPackage"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz"
assert index["desktopPackage"]["publicUrl"] == "https://cdn.example.test/skenion/releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz"
assert index["checksum"]["filename"] == "skenion-studio-x86_64-unknown-linux-gnu.tar.gz.sha256"
assert index["index"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-desktop-x86_64-unknown-linux-gnu-v1.2.3.index.json"
assert index["index"]["publicUrl"].endswith("/desktop/x86_64-unknown-linux-gnu/skenion-studio-desktop-x86_64-unknown-linux-gnu-v1.2.3.index.json")
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
assert len(put_indexes) == 3, events
for index, key in put_indexes:
    assert any(event == f"head {key}" for event in events[:index]), (key, events)
PY

  grep -q '^HEAD skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log"
  grep -q '^GET skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log"
  grep -q '^GET skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-desktop-x86_64-unknown-linux-gnu-v1.2.3\.index\.json$' "${case_dir}/curl.log"
}

assert_public_retry_case() {
  local case_dir="${tmp_root}/public-retry"
  local head_count
  local get_count

  prepare_case "${case_dir}" "studio desktop public retry artifact"
  run_publisher "${case_dir}" STUB_CURL_FAIL_HEAD_ATTEMPTS=2 STUB_CURL_FAIL_GET_ATTEMPTS=2 >"${case_dir}/output.log" 2>&1

  grep -q 'public Studio desktop release .*desktop package.* is not ready on attempt 1/3: HEAD request failed; retrying in 0s' "${case_dir}/output.log"
  grep -q 'public Studio desktop release .*desktop package.* is not ready on attempt 2/3: HEAD request failed; retrying in 0s' "${case_dir}/output.log"
  grep -q 'public Studio desktop release .*desktop package.* is not ready on attempt 1/3: GET request failed; retrying in 0s' "${case_dir}/output.log"
  grep -q 'public Studio desktop release .*desktop package.* is not ready on attempt 2/3: GET request failed; retrying in 0s' "${case_dir}/output.log"

  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package HEAD to retry until third attempt, saw ${head_count}" >&2
    exit 1
  fi

  get_count="$(grep -c '^GET skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${get_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package GET to retry until third attempt, saw ${get_count}" >&2
    exit 1
  fi
}

assert_public_default_retry_window_case() {
  local case_dir="${tmp_root}/public-default-retry-window"
  local head_count
  local sleep_count

  prepare_case "${case_dir}" "studio desktop public default retry window artifact"
  run_publisher "${case_dir}" \
    SKENION_PUBLIC_VERIFY_ATTEMPTS= \
    SKENION_PUBLIC_VERIFY_SLEEP_SECONDS= \
    STUB_CURL_FAIL_HEAD_RELATIVE_KEY=skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz \
    STUB_CURL_FAIL_HEAD_ATTEMPTS=35 >"${case_dir}/output.log" 2>&1

  grep -q 'public Studio desktop release .*desktop package.* is not ready on attempt 35/36: HEAD request failed; retrying in 5s' "${case_dir}/output.log"
  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "36" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package HEAD to use the 36-attempt default, saw ${head_count}" >&2
    exit 1
  fi

  sleep_count="$(grep -c '^sleep 5$' "${case_dir}/sleep.log" || true)"
  if [[ "${sleep_count}" != "35" ]]; then
    sed 's/^/[sleep] /' "${case_dir}/sleep.log" >&2
    echo "expected public desktop package default retries to sleep 5s between 35 attempts, saw ${sleep_count}" >&2
    exit 1
  fi
}

assert_public_head_failure_case() {
  local case_dir="${tmp_root}/public-head-failure"
  local head_count

  prepare_case "${case_dir}" "studio desktop public head failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_FAIL_HEAD_ATTEMPTS=3 >"${case_dir}/output.log" 2>&1; then
    echo "expected public desktop HEAD verification case to fail" >&2
    exit 1
  fi

  grep -q 'failed to verify public Studio desktop release .*desktop package' "${case_dir}/output.log"
  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package HEAD to fail after third attempt, saw ${head_count}" >&2
    exit 1
  fi
}

assert_public_get_failure_case() {
  local case_dir="${tmp_root}/public-get-failure"
  local get_count

  prepare_case "${case_dir}" "studio desktop public get failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_FAIL_GET_ATTEMPTS=3 >"${case_dir}/output.log" 2>&1; then
    echo "expected public desktop GET verification case to fail" >&2
    exit 1
  fi

  grep -q 'failed to download public Studio desktop release .*desktop package' "${case_dir}/output.log"
  get_count="$(grep -c '^GET skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${get_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package GET to fail after third attempt, saw ${get_count}" >&2
    exit 1
  fi
}

assert_public_content_length_failure_case() {
  local case_dir="${tmp_root}/public-content-length-failure"
  local head_count

  prepare_case "${case_dir}" "studio desktop public content length failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_MISMATCH_DESKTOP_ASSET_LENGTH=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected public desktop Content-Length verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio desktop release .*desktop package.* Content-Length does not match local file' "${case_dir}/output.log"
  head_count="$(grep -c '^HEAD skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${head_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package Content-Length mismatch to fail after third attempt, saw ${head_count}" >&2
    exit 1
  fi
}

assert_secretless_dry_run_defaults_case() {
  local case_dir="${tmp_root}/secretless-dry-run"
  local asset_path
  local index_path

  prepare_case "${case_dir}" "studio desktop secretless dry-run artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  index_path="$(asset_dir_for "${case_dir}")/skenion-studio-desktop-${target}-v${version}.index.json"

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
    "${asset_path}" \
    "${asset_path}.sha256" >"${case_dir}/output.log"

  python3 - "${index_path}" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    index = json.load(fh)

assert index["schema"] == "skenion.studio.desktopPackage.v1"
assert index["component"] == "skenion-studio"
assert index["studioVersion"] == "1.2.3"
assert index["releaseTag"] == "v1.2.3"
assert index["sourceCommit"] == "2222222222222222222222222222222222222222"
assert index["distribution"]["storage"] == "dsub-s3"
assert index["distribution"]["publicBaseUrl"] == "https://cdn.dsub.io/skenion/releases"
assert index["desktopPackage"]["s3"]["bucket"] == "skenion"
assert index["desktopPackage"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz"
assert index["desktopPackage"]["publicUrl"] == "https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz"
assert index["checksum"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz.sha256"
assert index["index"]["s3"]["key"] == "releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-desktop-x86_64-unknown-linux-gnu-v1.2.3.index.json"
PY

  grep -q 'dry run: would publish Studio desktop package to https://cdn.dsub.io/skenion/releases/skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu.tar.gz' "${case_dir}/output.log"
}

assert_no_clobber_case() {
  local case_dir="${tmp_root}/no-clobber"
  local asset_path
  local asset_name
  local existing

  prepare_case "${case_dir}" "studio desktop no-clobber artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_name="$(basename "${asset_path}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${target}/${asset_name}"
  mkdir -p "$(dirname "${existing}")"
  printf 'different existing asset\n' >"${existing}"
  write_stub_metadata "${existing}" "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected no-clobber publisher case to fail" >&2
    exit 1
  fi

  grep -q 'refusing to overwrite existing Studio desktop release artifact' "${case_dir}/output.log"
  if grep -q '^put ' "${case_dir}/aws.log"; then
    echo "publisher uploaded despite no-clobber refusal" >&2
    exit 1
  fi
}

assert_upload_missing_s3_metadata_is_not_a_failure_case() {
  local case_dir="${tmp_root}/upload-missing-s3-metadata"

  prepare_case "${case_dir}" "studio desktop upload missing s3 metadata artifact"
  run_publisher "${case_dir}" STUB_AWS_DROP_METADATA_ON_PUT=1 >"${case_dir}/output.log" 2>&1

  grep -q 'uploaded Studio desktop release object' "${case_dir}/output.log"
  if grep -q 'metadata does not match local file' "${case_dir}/output.log"; then
    echo "publisher required uploaded S3 metadata to round-trip" >&2
    exit 1
  fi
}

assert_existing_matching_metadata_skips_upload_case() {
  local case_dir="${tmp_root}/existing-matching-metadata"
  local asset_path
  local asset_name
  local asset_key
  local existing
  local expected_sha

  prepare_case "${case_dir}" "studio desktop existing matching metadata artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_name="$(basename "${asset_path}")"
  asset_key="${prefix}/skenion-studio/${release_tag}/desktop/${target}/${asset_name}"
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

assert_existing_missing_metadata_skips_matching_asset_case() {
  local case_dir="${tmp_root}/existing-missing-metadata"
  local asset_path
  local asset_name
  local asset_key
  local existing

  prepare_case "${case_dir}" "studio desktop existing missing metadata artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_name="$(basename "${asset_path}")"
  asset_key="${prefix}/skenion-studio/${release_tag}/desktop/${target}/${asset_name}"
  existing="${case_dir}/s3/${bucket}/${asset_key}"
  mkdir -p "$(dirname "${existing}")"
  cp "${asset_path}" "${existing}"

  run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1

  grep -q 'object already exists without immutable metadata and matching size' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${asset_key}$" "${case_dir}/aws.log"; then
    echo "publisher re-uploaded an existing metadata-free object with matching size" >&2
    exit 1
  fi
}

assert_existing_missing_metadata_mismatched_size_case() {
  local case_dir="${tmp_root}/existing-missing-metadata-size-mismatch"
  local asset_path
  local asset_name
  local existing

  prepare_case "${case_dir}" "studio desktop existing missing metadata size mismatch artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_name="$(basename "${asset_path}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${target}/${asset_name}"
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
  local asset_path
  local asset_name
  local existing

  prepare_case "${case_dir}" "studio desktop existing mismatched metadata artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_name="$(basename "${asset_path}")"
  existing="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${target}/${asset_name}"
  mkdir -p "$(dirname "${existing}")"
  cp "${asset_path}" "${existing}"
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
  local asset_path
  local asset_name
  local asset_key
  local existing

  prepare_case "${case_dir}" "studio desktop existing missing metadata content mismatch artifact"
  asset_path="$(asset_path_for "${case_dir}")"
  asset_name="$(basename "${asset_path}")"
  asset_key="${prefix}/skenion-studio/${release_tag}/desktop/${target}/${asset_name}"
  existing="${case_dir}/s3/${bucket}/${asset_key}"
  mkdir -p "$(dirname "${existing}")"
  cp "${asset_path}" "${existing}"
  printf 'X' | dd of="${existing}" bs=1 count=1 conv=notrunc >/dev/null 2>&1

  if run_publisher "${case_dir}" >"${case_dir}/output.log" 2>&1; then
    echo "expected existing missing metadata content mismatch case to fail" >&2
    exit 1
  fi

  grep -q 'object already exists without immutable metadata and matching size' "${case_dir}/output.log"
  grep -q 'public Studio desktop release .*desktop package.* content does not match local file' "${case_dir}/output.log"
  if grep -q "^put ${bucket}/${asset_key}$" "${case_dir}/aws.log"; then
    echo "publisher overwrote metadata-free same-size object before public content verification" >&2
    exit 1
  fi
}

assert_public_content_failure_case() {
  local case_dir="${tmp_root}/public-content-failure"
  local get_count

  prepare_case "${case_dir}" "studio desktop public content failure artifact"
  if run_publisher "${case_dir}" STUB_CURL_CORRUPT_DESKTOP_ASSET=1 >"${case_dir}/output.log" 2>&1; then
    echo "expected public content verification case to fail" >&2
    exit 1
  fi

  grep -q 'public Studio desktop release .*desktop package.* content does not match local file' "${case_dir}/output.log"
  get_count="$(grep -c '^GET skenion-studio/v1.2.3/desktop/x86_64-unknown-linux-gnu/skenion-studio-x86_64-unknown-linux-gnu\.tar\.gz$' "${case_dir}/curl.log" || true)"
  if [[ "${get_count}" != "3" ]]; then
    sed 's/^/[curl] /' "${case_dir}/curl.log" >&2
    echo "expected public desktop package content mismatch to fail after third attempt, saw ${get_count}" >&2
    exit 1
  fi
}

install_stubs "${tmp_root}/bin"
assert_github_actions_guard_case
assert_success_case
assert_public_retry_case
assert_public_default_retry_window_case
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

echo "Studio desktop DSUB S3 publisher validation passed."
