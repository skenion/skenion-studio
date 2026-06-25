#!/usr/bin/env bash
set -euo pipefail

require_existing=false
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --require-existing)
      require_existing=true
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ $# -ne 4 ]]; then
  echo "usage: $0 [--require-existing] <version> <release-tag> <target> <tier>" >&2
  exit 2
fi

version="$1"
release_tag="$2"
target="$3"
tier="$4"

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
  elif command -v python >/dev/null 2>&1; then
    command -v python
  else
    echo "python3 or python is required for Studio desktop S3 artifact preflight." >&2
    exit 1
  fi
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "required environment variable is missing: ${name}" >&2
    exit 1
  fi
}

trim_slashes() {
  local value="$1"
  value="${value#/}"
  value="${value%/}"
  printf '%s' "${value}"
}

join_key() {
  local prefix="$1"
  local suffix="$2"
  if [[ -n "${prefix}" ]]; then
    printf '%s/%s' "${prefix}" "${suffix}"
  else
    printf '%s' "${suffix}"
  fi
}

relative_public_key() {
  local prefix="$1"
  local key="$2"
  if [[ -n "${prefix}" && "${key}" == "${prefix}/"* ]]; then
    printf '%s' "${key#"${prefix}/"}"
  else
    printf '%s' "${key}"
  fi
}

public_url() {
  local relative_key="$1"
  printf '%s/%s' "${SKENION_RELEASE_PUBLIC_BASE_URL%/}" "${relative_key#/}"
}

sha256_file() {
  local path="$1"
  "${python_bin}" - "${path}" <<'PY'
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
  local path="$1"
  if stat -c '%s' "${path}" >/dev/null 2>&1; then
    stat -c '%s' "${path}"
  else
    stat -f '%z' "${path}"
  fi
}

validate_inputs() {
  if [[ ! "${version}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "version must use x.y.z SemVer form; got '${version}'." >&2
    exit 1
  fi

  if [[ "${release_tag}" != "v${version}" ]]; then
    echo "release tag ${release_tag} must match v${version}." >&2
    exit 1
  fi

  case "${target}" in
    aarch64-apple-darwin|x86_64-apple-darwin|x86_64-pc-windows-msvc|aarch64-pc-windows-msvc|x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
      ;;
    *)
      echo "unsupported Studio desktop target: ${target}" >&2
      exit 1
      ;;
  esac

  case "${tier}" in
    release-blocking|preview)
      ;;
    *)
      echo "desktop target tier must be release-blocking or preview; got '${tier}'." >&2
      exit 1
      ;;
  esac
}

required_package_rows() {
  case "${target}" in
    aarch64-apple-darwin)
      printf '%s\t%s\t%s\n' "macos-apple-silicon" "dmg" "skenion-studio-v${version}-macos-apple-silicon.dmg"
      ;;
    x86_64-apple-darwin)
      printf '%s\t%s\t%s\n' "macos-intel" "dmg" "skenion-studio-v${version}-macos-intel.dmg"
      ;;
    x86_64-pc-windows-msvc)
      printf '%s\t%s\t%s\n' "windows-x64" "nsis-setup" "skenion-studio-v${version}-windows-x64-setup.exe"
      ;;
    aarch64-pc-windows-msvc)
      printf '%s\t%s\t%s\n' "windows-arm64" "nsis-setup" "skenion-studio-v${version}-windows-arm64-setup.exe"
      ;;
    x86_64-unknown-linux-gnu)
      printf '%s\t%s\t%s\n' "linux-x64-deb" "deb" "skenion-studio-v${version}-linux-x64.deb"
      printf '%s\t%s\t%s\n' "linux-x64-rpm" "rpm" "skenion-studio-v${version}-linux-x64.rpm"
      ;;
    aarch64-unknown-linux-gnu)
      printf '%s\t%s\t%s\n' "linux-arm64-deb" "deb" "skenion-studio-v${version}-linux-arm64.deb"
      printf '%s\t%s\t%s\n' "linux-arm64-rpm" "rpm" "skenion-studio-v${version}-linux-arm64.rpm"
      ;;
  esac
}

object_state() {
  local key="$1"
  local label="$2"
  local head_path="$3"
  local error_path="$4"

  : >"${error_path}"
  if aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api head-object \
    --bucket "${SKENION_RELEASE_S3_BUCKET}" \
    --key "${key}" >"${head_path}" 2>"${error_path}"; then
    printf '%s' "exists"
    return 0
  fi

  if grep -Eiq '(404|Not Found|NoSuchKey|NotFound)' "${error_path}"; then
    echo "missing Studio desktop release ${label}: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    printf '%s' "missing"
    return 0
  fi

  if grep -Eiq '(403|Forbidden|AccessDenied)' "${error_path}"; then
    echo "could not inspect Studio desktop release ${label}; treating it as non-reusable preflight evidence: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    printf '%s' "unknown"
    return 0
  fi

  echo "failed to inspect Studio desktop release ${label}: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
  cat "${error_path}" >&2
  exit 1
}

download_object() {
  local key="$1"
  local destination="$2"
  local label="$3"
  local error_path="$4"

  : >"${error_path}"
  if ! aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api get-object \
    --bucket "${SKENION_RELEASE_S3_BUCKET}" \
    --key "${key}" \
    "${destination}" >/dev/null 2>"${error_path}"; then
    echo "failed to download Studio desktop release ${label}: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    cat "${error_path}" >&2
    exit 1
  fi
}

validate_existing_metadata() {
  local package_id="$1"
  local family="$2"
  local asset_name="$3"
  local checksum_name="$4"
  local index_name="$5"
  local asset_key="$6"
  local checksum_key="$7"
  local index_key="$8"
  local asset_url="$9"
  local checksum_url="${10}"
  local index_url="${11}"
  local asset_head="${12}"
  local checksum_head="${13}"
  local index_head="${14}"
  local checksum_body="${15}"
  local index_body="${16}"

  "${python_bin}" - \
    "${version}" \
    "${release_tag}" \
    "${source_commit}" \
    "${package_id}" \
    "${family}" \
    "${tier}" \
    "${runtime_tag}" \
    "${desktop_signing_mode}" \
    "${SKENION_RELEASE_S3_BUCKET}" \
    "${SKENION_RELEASE_PUBLIC_BASE_URL}" \
    "${asset_name}" \
    "${checksum_name}" \
    "${index_name}" \
    "${asset_key}" \
    "${checksum_key}" \
    "${index_key}" \
    "${asset_url}" \
    "${checksum_url}" \
    "${index_url}" \
    "${asset_head}" \
    "${checksum_head}" \
    "${index_head}" \
    "${checksum_body}" \
    "${index_body}" <<'PY'
import hashlib
import json
import re
import sys

(
    version,
    release_tag,
    source_commit,
    package_id,
    family,
    tier,
    runtime_tag,
    desktop_signing_mode,
    bucket,
    public_base_url,
    asset_name,
    checksum_name,
    index_name,
    asset_key,
    checksum_key,
    index_key,
    asset_url,
    checksum_url,
    index_url,
    asset_head_path,
    checksum_head_path,
    index_head_path,
    checksum_body_path,
    index_body_path,
) = sys.argv[1:]

hex_sha = re.compile(r"^[0-9a-f]{64}$")

def load_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)

def read_bytes(path):
    with open(path, "rb") as fh:
        return fh.read()

def sha256_bytes(value):
    return hashlib.sha256(value).hexdigest()

def fail(message):
    raise SystemExit(message)

def require_equal(actual, expected, label):
    if actual != expected:
        fail(f"{label} expected {expected!r}, got {actual!r}")

def require_sha(value, label):
    if not isinstance(value, str) or not hex_sha.match(value):
        fail(f"{label} must be a lowercase sha256 hex digest")

def metadata(head):
    value = head.get("Metadata") or {}
    return {str(key).lower(): str(item) for key, item in value.items()}

def require_common_metadata(head, label):
    meta = metadata(head)
    require_equal(meta.get("component"), "skenion-studio", f"{label} metadata component")
    require_equal(meta.get("artifact-set"), "desktop", f"{label} metadata artifact-set")
    require_equal(meta.get("studio-version"), version, f"{label} metadata studio-version")
    require_equal(meta.get("source-tag"), release_tag, f"{label} metadata source-tag")
    require_equal(meta.get("source-commit"), source_commit, f"{label} metadata source-commit")
    require_equal(meta.get("package-id"), package_id, f"{label} metadata package-id")
    require_sha(meta.get("sha256"), f"{label} metadata sha256")
    if not isinstance(head.get("ContentLength"), int) or head["ContentLength"] <= 0:
        fail(f"{label} must have a positive S3 ContentLength")
    return meta

asset_head = load_json(asset_head_path)
checksum_head = load_json(checksum_head_path)
index_head = load_json(index_head_path)
checksum_body = read_bytes(checksum_body_path)
index_body = read_bytes(index_body_path)
index = json.loads(index_body.decode("utf-8"))

asset_meta = require_common_metadata(asset_head, "desktop installer")
checksum_meta = require_common_metadata(checksum_head, "desktop checksum")
index_meta = require_common_metadata(index_head, "desktop index")

checksum_sha = sha256_bytes(checksum_body)
index_sha = sha256_bytes(index_body)
require_equal(checksum_meta["sha256"], checksum_sha, "desktop checksum metadata sha256")
require_equal(checksum_head["ContentLength"], len(checksum_body), "desktop checksum ContentLength")
require_equal(index_meta["sha256"], index_sha, "desktop index metadata sha256")
require_equal(index_head["ContentLength"], len(index_body), "desktop index ContentLength")

checksum_line = checksum_body.decode("utf-8").strip().split()
if len(checksum_line) < 2:
    fail("desktop checksum file must contain sha256 and installer filename")
asset_sha = checksum_line[0]
declared_asset_name = checksum_line[1]
require_sha(asset_sha, "desktop checksum file sha256")
if declared_asset_name not in {asset_name, f"./{asset_name}", f"*{asset_name}"}:
    fail(f"desktop checksum file points at {declared_asset_name!r}, expected {asset_name!r}")

require_equal(asset_meta["sha256"], asset_sha, "desktop installer metadata sha256")

require_equal(index.get("schema"), "skenion.studio.desktopPackage.v1", "desktop index schema")
require_equal(index.get("component"), "skenion-studio", "desktop index component")
require_equal(index.get("studioVersion"), version, "desktop index studioVersion")
require_equal(index.get("releaseTag"), release_tag, "desktop index releaseTag")
require_equal(index.get("sourceCommit"), source_commit, "desktop index sourceCommit")
require_equal(index.get("packageId"), package_id, "desktop index packageId")
require_equal(index.get("family"), family, "desktop index family")
require_equal(index.get("tier"), tier, "desktop index tier")
require_equal((index.get("runtime") or {}).get("releaseTag"), runtime_tag, "desktop index runtime.releaseTag")
require_equal((index.get("runtime") or {}).get("binarySource"), "skenion-runtime-release-manifest", "desktop index runtime.binarySource")
require_equal((index.get("signing") or {}).get("mode"), desktop_signing_mode, "desktop index signing.mode")
require_equal((index.get("distribution") or {}).get("storage"), "dsub-s3", "desktop index distribution.storage")
require_equal((index.get("distribution") or {}).get("publicBaseUrl"), public_base_url, "desktop index distribution.publicBaseUrl")

desktop_installer = index.get("desktopInstaller") or {}
require_equal(desktop_installer.get("filename"), asset_name, "desktop index installer filename")
require_equal(desktop_installer.get("sha256"), asset_sha, "desktop index installer sha256")
require_equal(desktop_installer.get("size"), asset_head["ContentLength"], "desktop index installer size")
require_equal((desktop_installer.get("s3") or {}).get("bucket"), bucket, "desktop index installer s3.bucket")
require_equal((desktop_installer.get("s3") or {}).get("key"), asset_key, "desktop index installer s3.key")
require_equal(desktop_installer.get("publicUrl"), asset_url, "desktop index installer publicUrl")

checksum = index.get("checksum") or {}
require_equal(checksum.get("filename"), checksum_name, "desktop index checksum filename")
require_equal(checksum.get("sha256"), checksum_sha, "desktop index checksum sha256")
require_equal(checksum.get("size"), len(checksum_body), "desktop index checksum size")
require_equal((checksum.get("s3") or {}).get("bucket"), bucket, "desktop index checksum s3.bucket")
require_equal((checksum.get("s3") or {}).get("key"), checksum_key, "desktop index checksum s3.key")
require_equal(checksum.get("publicUrl"), checksum_url, "desktop index checksum publicUrl")

index_section = index.get("index") or {}
require_equal(index_section.get("filename"), index_name, "desktop index index.filename")
require_equal((index_section.get("s3") or {}).get("bucket"), bucket, "desktop index index.s3.bucket")
require_equal((index_section.get("s3") or {}).get("key"), index_key, "desktop index index.s3.key")
require_equal(index_section.get("publicUrl"), index_url, "desktop index index.publicUrl")
PY
}

validate_inputs
python_bin="$(find_python)"
source_commit="${SOURCE_COMMIT:-${GITHUB_SHA:-}}"
runtime_tag="${RUNTIME_TAG:-}"
desktop_signing_mode="${DESKTOP_SIGNING_MODE:-}"

for env_name in \
  SKENION_RELEASE_S3_ENDPOINT \
  SKENION_RELEASE_S3_REGION \
  SKENION_RELEASE_S3_BUCKET \
  SKENION_RELEASE_S3_PREFIX \
  SKENION_RELEASE_S3_ACCESS_KEY_ID \
  SKENION_RELEASE_S3_SECRET_ACCESS_KEY \
  SKENION_RELEASE_S3_FORCE_PATH_STYLE \
  SKENION_RELEASE_PUBLIC_BASE_URL; do
  require_env "${env_name}"
done
require_env RUNTIME_TAG
require_env DESKTOP_SIGNING_MODE
if [[ -z "${source_commit}" ]]; then
  echo "SOURCE_COMMIT or GITHUB_SHA is required for Studio desktop S3 artifact preflight." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required for Studio desktop S3 artifact preflight." >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${SKENION_RELEASE_S3_ACCESS_KEY_ID}}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${SKENION_RELEASE_S3_SECRET_ACCESS_KEY}}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${SKENION_RELEASE_S3_REGION}}"
export AWS_PAGER=""

if [[ "${SKENION_RELEASE_S3_FORCE_PATH_STYLE:-}" =~ ^(1|true|TRUE|yes|YES)$ ]]; then
  aws configure set default.s3.addressing_style path
fi

prefix="$(trim_slashes "${SKENION_RELEASE_S3_PREFIX}")"
package_rows="$(mktemp)"
summary_file="$(mktemp)"
error_path="$(mktemp)"
cleanup() {
  rm -f "${package_rows}" "${summary_file}" "${error_path}"
}
trap cleanup EXIT

required_package_rows >"${package_rows}"

all_existing=true
package_ids=()
missing_package_ids=()

while IFS=$'\t' read -r package_id family asset_name; do
  package_ids+=("${package_id}")
  checksum_name="${asset_name}.sha256"
  index_name="skenion-studio-desktop-${package_id}-v${version}.index.json"
  artifact_dir="$(join_key "${prefix}" "skenion-studio/${release_tag}/desktop/${package_id}")"
  asset_key="$(join_key "${artifact_dir}" "${asset_name}")"
  checksum_key="$(join_key "${artifact_dir}" "${checksum_name}")"
  index_key="$(join_key "${artifact_dir}" "${index_name}")"
  asset_url="$(public_url "$(relative_public_key "${prefix}" "${asset_key}")")"
  checksum_url="$(public_url "$(relative_public_key "${prefix}" "${checksum_key}")")"
  index_url="$(public_url "$(relative_public_key "${prefix}" "${index_key}")")"

  asset_head="$(mktemp)"
  checksum_head="$(mktemp)"
  index_head="$(mktemp)"
  checksum_body="$(mktemp)"
  index_body="$(mktemp)"
  package_cleanup() {
    rm -f "${asset_head}" "${checksum_head}" "${index_head}" "${checksum_body}" "${index_body}"
  }

  asset_state="$(object_state "${asset_key}" "installer ${package_id}" "${asset_head}" "${error_path}")"
  checksum_state="$(object_state "${checksum_key}" "checksum ${package_id}" "${checksum_head}" "${error_path}")"
  index_state="$(object_state "${index_key}" "index ${package_id}" "${index_head}" "${error_path}")"

  if [[ "${asset_state}" == "exists" && "${checksum_state}" == "exists" && "${index_state}" == "exists" ]]; then
    download_object "${checksum_key}" "${checksum_body}" "checksum ${package_id}" "${error_path}"
    download_object "${index_key}" "${index_body}" "index ${package_id}" "${error_path}"
    validate_existing_metadata \
      "${package_id}" \
      "${family}" \
      "${asset_name}" \
      "${checksum_name}" \
      "${index_name}" \
      "${asset_key}" \
      "${checksum_key}" \
      "${index_key}" \
      "${asset_url}" \
      "${checksum_url}" \
      "${index_url}" \
      "${asset_head}" \
      "${checksum_head}" \
      "${index_head}" \
      "${checksum_body}" \
      "${index_body}"
    printf -- '- %s: %s (checksum: %s)\n' "${package_id}" "${asset_url}" "${checksum_url}" >>"${summary_file}"
    echo "found reusable Studio desktop release package evidence: s3://${SKENION_RELEASE_S3_BUCKET}/${artifact_dir}"
  else
    all_existing=false
    missing_package_ids+=("${package_id}")
  fi

  package_cleanup
done <"${package_rows}"

exists=false
if [[ "${all_existing}" == "true" ]]; then
  exists=true
fi

join_by_comma() {
  local IFS=,
  printf '%s' "$*"
}

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "exists=${exists}"
    echo "package_ids=$(join_by_comma "${package_ids[@]}")"
    echo "missing_package_ids=$(join_by_comma "${missing_package_ids[@]}")"
    echo "artifact_count=${#package_ids[@]}"
    echo "desktop_artifact_summary<<SKENION_DESKTOP_ARTIFACTS"
    if [[ -s "${summary_file}" ]]; then
      cat "${summary_file}"
    fi
    echo "SKENION_DESKTOP_ARTIFACTS"
  } >>"${GITHUB_OUTPUT}"
fi

if [[ "${exists}" == "true" ]]; then
  echo "studio_desktop_package_exists=true"
else
  echo "studio_desktop_package_exists=false"
  if ((${#missing_package_ids[@]} > 0)); then
    echo "missing_or_unverified_packages=$(join_by_comma "${missing_package_ids[@]}")"
  fi
  if [[ "${require_existing}" == "true" ]]; then
    echo "required Studio desktop release package evidence is missing or unverified: $(join_by_comma "${missing_package_ids[@]}")" >&2
    exit 1
  fi
fi
