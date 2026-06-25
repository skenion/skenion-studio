#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
checker="${repo_root}/scripts/check-studio-desktop-asset-s3-existing.sh"
tmp_root="$(mktemp -d)"

cleanup() {
  rm -rf "${tmp_root}"
}
trap cleanup EXIT

bucket="skenion"
prefix="releases"
version="1.2.3"
release_tag="v${version}"
source_commit="0123456789abcdef0123456789abcdef01234567"
runtime_tag="v4.5.6"
desktop_signing_mode="unsigned-preview"
public_base_url="https://cdn.dsub.io/skenion/releases"

write_stub_aws() {
  local bin_dir="$1"
  mkdir -p "${bin_dir}"
  cat >"${bin_dir}/aws" <<'BASH'
#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--endpoint-url" ]]; then
  shift 2
fi

command_name="${1:-}"
shift || true

root="${STUB_S3_ROOT:?}"

object_path() {
  local bucket=""
  local key=""
  while (($# > 0)); do
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
  printf '%s/%s/%s' "${root}" "${bucket}" "${key}"
}

content_length() {
  wc -c <"$1" | tr -d ' '
}

case "${command_name}" in
  configure)
    exit 0
    ;;
  s3api)
    subcommand="${1:-}"
    shift || true
    case "${subcommand}" in
      head-object)
        path="$(object_path "$@")"
        if [[ ! -f "${path}" ]]; then
          echo "An error occurred (404) when calling the HeadObject operation: Not Found" >&2
          exit 255
        fi
        if [[ -f "${path}.metadata.json" ]]; then
          cat "${path}.metadata.json"
        else
          printf '{"ContentLength":%s,"Metadata":{}}\n' "$(content_length "${path}")"
        fi
        ;;
      get-object)
        destination="${@: -1}"
        args=("$@")
        unset 'args[${#args[@]}-1]'
        path="$(object_path "${args[@]}")"
        if [[ ! -f "${path}" ]]; then
          echo "An error occurred (NoSuchKey) when calling the GetObject operation: Not Found" >&2
          exit 255
        fi
        cp "${path}" "${destination}"
        printf '{"ContentLength":%s}\n' "$(content_length "${path}")"
        ;;
      *)
        echo "unsupported aws s3api subcommand: ${subcommand}" >&2
        exit 2
        ;;
    esac
    ;;
  *)
    echo "unsupported aws command: ${command_name}" >&2
    exit 2
    ;;
esac
BASH
  chmod +x "${bin_dir}/aws"
}

sha256_file() {
  python3 - "$1" <<'PY'
import hashlib
import sys

digest = hashlib.sha256()
with open(sys.argv[1], "rb") as fh:
    for chunk in iter(lambda: fh.read(1024 * 1024), b""):
        digest.update(chunk)
print(digest.hexdigest())
PY
}

file_size() {
  wc -c <"$1" | tr -d ' '
}

write_metadata() {
  local object_path="$1"
  local package_id="$2"
  local sha="$3"
  local size
  size="$(file_size "${object_path}")"
  python3 - "${object_path}.metadata.json" "${size}" "${sha}" "${package_id}" "${version}" "${release_tag}" "${source_commit}" <<'PY'
import json
import sys

path, size, sha, package_id, version, release_tag, source_commit = sys.argv[1:]
metadata = {
    "ContentLength": int(size),
    "Metadata": {
        "sha256": sha,
        "component": "skenion-studio",
        "artifact-set": "desktop",
        "studio-version": version,
        "source-tag": release_tag,
        "source-commit": source_commit,
        "package-id": package_id,
    },
}
with open(path, "w", encoding="utf-8") as fh:
    json.dump(metadata, fh, sort_keys=True)
    fh.write("\n")
PY
}

create_package() {
  local case_dir="$1"
  local package_id="$2"
  local family="$3"
  local asset_name="$4"
  local target_dir="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/${package_id}"
  local checksum_name="${asset_name}.sha256"
  local index_name="skenion-studio-desktop-${package_id}-v${version}.index.json"
  local asset_path="${target_dir}/${asset_name}"
  local checksum_path="${target_dir}/${checksum_name}"
  local index_path="${target_dir}/${index_name}"
  local asset_key="${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/${asset_name}"
  local checksum_key="${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/${checksum_name}"
  local index_key="${prefix}/skenion-studio/${release_tag}/desktop/${package_id}/${index_name}"
  local asset_url="${public_base_url}/skenion-studio/${release_tag}/desktop/${package_id}/${asset_name}"
  local checksum_url="${public_base_url}/skenion-studio/${release_tag}/desktop/${package_id}/${checksum_name}"
  local index_url="${public_base_url}/skenion-studio/${release_tag}/desktop/${package_id}/${index_name}"
  local asset_sha
  local asset_size
  local checksum_sha
  local checksum_size
  local index_sha

  mkdir -p "${target_dir}"
  printf 'fixture installer for %s\n' "${package_id}" >"${asset_path}"
  asset_sha="$(sha256_file "${asset_path}")"
  asset_size="$(file_size "${asset_path}")"
  printf '%s  %s\n' "${asset_sha}" "${asset_name}" >"${checksum_path}"
  checksum_sha="$(sha256_file "${checksum_path}")"
  checksum_size="$(file_size "${checksum_path}")"

  python3 - \
    "${index_path}" \
    "${version}" \
    "${release_tag}" \
    "${source_commit}" \
    "${package_id}" \
    "${family}" \
    "${runtime_tag}" \
    "${desktop_signing_mode}" \
    "${bucket}" \
    "${public_base_url}" \
    "${asset_name}" \
    "${asset_key}" \
    "${asset_url}" \
    "${asset_sha}" \
    "${asset_size}" \
    "${checksum_name}" \
    "${checksum_key}" \
    "${checksum_url}" \
    "${checksum_sha}" \
    "${checksum_size}" \
    "${index_name}" \
    "${index_key}" \
    "${index_url}" <<'PY'
import json
import sys

(
    path,
    version,
    release_tag,
    source_commit,
    package_id,
    family,
    runtime_tag,
    desktop_signing_mode,
    bucket,
    public_base_url,
    asset_name,
    asset_key,
    asset_url,
    asset_sha,
    asset_size,
    checksum_name,
    checksum_key,
    checksum_url,
    checksum_sha,
    checksum_size,
    index_name,
    index_key,
    index_url,
) = sys.argv[1:]

index = {
    "schema": "skenion.studio.desktopPackage.v1",
    "component": "skenion-studio",
    "studioVersion": version,
    "releaseTag": release_tag,
    "sourceCommit": source_commit,
    "packageId": package_id,
    "family": family,
    "tier": "release-blocking",
    "contracts": {"version": None, "line": None, "range": None},
    "runtime": {
        "releaseTag": runtime_tag,
        "binarySource": "skenion-runtime-release-manifest",
    },
    "signing": {"mode": desktop_signing_mode},
    "distribution": {
        "storage": "dsub-s3",
        "publicBaseUrl": public_base_url,
    },
    "desktopInstaller": {
        "filename": asset_name,
        "sha256": asset_sha,
        "size": int(asset_size),
        "s3": {"bucket": bucket, "key": asset_key},
        "publicUrl": asset_url,
    },
    "checksum": {
        "filename": checksum_name,
        "sha256": checksum_sha,
        "size": int(checksum_size),
        "s3": {"bucket": bucket, "key": checksum_key},
        "publicUrl": checksum_url,
    },
    "index": {
        "filename": index_name,
        "s3": {"bucket": bucket, "key": index_key},
        "publicUrl": index_url,
    },
}

with open(path, "w", encoding="utf-8") as fh:
    json.dump(index, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY

  index_sha="$(sha256_file "${index_path}")"
  write_metadata "${asset_path}" "${package_id}" "${asset_sha}"
  write_metadata "${checksum_path}" "${package_id}" "${checksum_sha}"
  write_metadata "${index_path}" "${package_id}" "${index_sha}"
}

run_checker() {
  local case_dir="$1"
  local target="$2"
  local output_path="$3"
  local mode="${4:-preflight}"
  local github_output="${case_dir}/github-output.txt"
  local checker_option=""
  local status
  : >"${github_output}"
  if [[ "${mode}" == "require-existing" ]]; then
    checker_option="--require-existing"
  fi
  set +e
  PATH="${case_dir}/bin:${PATH}" \
    STUB_S3_ROOT="${case_dir}/s3" \
    GITHUB_OUTPUT="${github_output}" \
    SOURCE_COMMIT="${source_commit}" \
    RUNTIME_TAG="${runtime_tag}" \
    DESKTOP_SIGNING_MODE="${desktop_signing_mode}" \
    SKENION_RELEASE_S3_ENDPOINT="https://s3.example.test" \
    SKENION_RELEASE_S3_REGION="us-east-1" \
    SKENION_RELEASE_S3_BUCKET="${bucket}" \
    SKENION_RELEASE_S3_PREFIX="${prefix}" \
    SKENION_RELEASE_S3_ACCESS_KEY_ID="test-access-key" \
    SKENION_RELEASE_S3_SECRET_ACCESS_KEY="test-secret-key" \
    SKENION_RELEASE_S3_FORCE_PATH_STYLE="true" \
    SKENION_RELEASE_PUBLIC_BASE_URL="${public_base_url}" \
    "${checker}" ${checker_option:+"${checker_option}"} "${version}" "${release_tag}" "${target}" "release-blocking" >"${output_path}" 2>&1
  status=$?
  set -e
  cat "${github_output}" >>"${output_path}"
  return "${status}"
}

assert_existing_linux_platform_skips() {
  local case_dir="${tmp_root}/existing-linux"
  local output_path="${case_dir}/output.log"
  mkdir -p "${case_dir}"
  write_stub_aws "${case_dir}/bin"
  create_package "${case_dir}" "linux-x64-deb" "deb" "skenion-studio-v${version}-linux-x64.deb"
  create_package "${case_dir}" "linux-x64-rpm" "rpm" "skenion-studio-v${version}-linux-x64.rpm"

  run_checker "${case_dir}" "x86_64-unknown-linux-gnu" "${output_path}"

  grep -q '^exists=true$' "${output_path}"
  grep -q '^package_ids=linux-x64-deb,linux-x64-rpm$' "${output_path}"
  grep -q 'found reusable Studio desktop release package evidence' "${output_path}"
}

assert_missing_required_package_rebuilds() {
  local case_dir="${tmp_root}/missing-linux-rpm"
  local output_path="${case_dir}/output.log"
  mkdir -p "${case_dir}"
  write_stub_aws "${case_dir}/bin"
  create_package "${case_dir}" "linux-x64-deb" "deb" "skenion-studio-v${version}-linux-x64.deb"

  run_checker "${case_dir}" "x86_64-unknown-linux-gnu" "${output_path}"

  grep -q '^exists=false$' "${output_path}"
  grep -q '^missing_package_ids=linux-x64-rpm$' "${output_path}"
  grep -q '^studio_desktop_package_exists=false$' "${output_path}"
}

assert_missing_required_package_fails_strict() {
  local case_dir="${tmp_root}/missing-linux-rpm-strict"
  local output_path="${case_dir}/output.log"
  mkdir -p "${case_dir}"
  write_stub_aws "${case_dir}/bin"
  create_package "${case_dir}" "linux-x64-deb" "deb" "skenion-studio-v${version}-linux-x64.deb"

  if run_checker "${case_dir}" "x86_64-unknown-linux-gnu" "${output_path}" "require-existing"; then
    echo "expected strict missing required package evidence to fail" >&2
    exit 1
  fi

  grep -q '^exists=false$' "${output_path}"
  grep -q '^missing_package_ids=linux-x64-rpm$' "${output_path}"
  grep -q 'required Studio desktop release package evidence is missing or unverified: linux-x64-rpm' "${output_path}"
}

assert_bad_checksum_evidence_fails() {
  local case_dir="${tmp_root}/bad-checksum"
  local output_path="${case_dir}/output.log"
  local checksum_path
  mkdir -p "${case_dir}"
  write_stub_aws "${case_dir}/bin"
  create_package "${case_dir}" "macos-apple-silicon" "dmg" "skenion-studio-v${version}-macos-apple-silicon.dmg"
  checksum_path="${case_dir}/s3/${bucket}/${prefix}/skenion-studio/${release_tag}/desktop/macos-apple-silicon/skenion-studio-v${version}-macos-apple-silicon.dmg.sha256"
  printf 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff  skenion-studio-v%s-macos-apple-silicon.dmg\n' "${version}" >"${checksum_path}"
  write_metadata "${checksum_path}" "macos-apple-silicon" "$(sha256_file "${checksum_path}")"

  if run_checker "${case_dir}" "aarch64-apple-darwin" "${output_path}"; then
    echo "expected bad checksum evidence to fail" >&2
    exit 1
  fi

  grep -q 'desktop installer metadata sha256' "${output_path}"
}

assert_existing_linux_platform_skips
assert_missing_required_package_rebuilds
assert_missing_required_package_fails_strict
assert_bad_checksum_evidence_fails

echo "Studio desktop S3 existing-artifact preflight validation passed."
