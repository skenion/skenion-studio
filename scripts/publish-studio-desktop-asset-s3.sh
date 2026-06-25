#!/usr/bin/env bash
set -euo pipefail

dry_run=false
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --dry-run)
      dry_run=true
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ $# -ne 5 ]]; then
  echo "usage: $0 [--dry-run] <version> <release-tag> <target> <tier> <installer-manifest-path>" >&2
  exit 2
fi

version="$1"
release_tag="$2"
target="$3"
tier="$4"
installer_manifest_path="$5"

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
  elif command -v python >/dev/null 2>&1; then
    command -v python
  else
    echo "python3 or python is required for Studio desktop release metadata generation." >&2
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

require_github_actions_publish_context() {
  if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
    echo "Studio desktop artifact publishing must run from GitHub Actions." >&2
    exit 1
  fi

  case "${GITHUB_EVENT_NAME:-}" in
    workflow_dispatch|repository_dispatch)
      ;;
    *)
      echo "Studio desktop artifact publishing is only allowed for workflow_dispatch or repository_dispatch events." >&2
      exit 1
      ;;
  esac
}

require_file() {
  local path="$1"
  if [[ ! -f "${path}" ]]; then
    echo "required file does not exist: ${path}" >&2
    exit 1
  fi
}

file_size() {
  local path="$1"
  if stat -c '%s' "${path}" >/dev/null 2>&1; then
    stat -c '%s' "${path}"
  else
    stat -f '%z' "${path}"
  fi
}

sha256_file() {
  local path="$1"

  "${python_bin:-$(find_python)}" - "${path}" <<'PY'
import hashlib
import sys

digest = hashlib.sha256()
with open(sys.argv[1], "rb") as fh:
    for chunk in iter(lambda: fh.read(1024 * 1024), b""):
        digest.update(chunk)
print(digest.hexdigest())
PY
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

verify_checksum_file() {
  local asset_path="$1"
  local checksum_path="$2"
  local actual_sha
  local declared_sha
  local declared_name
  local asset_name

  actual_sha="$(sha256_file "${asset_path}")"
  declared_sha="$(awk '{print $1; exit}' "${checksum_path}")"
  declared_name="$(awk '{print $2; exit}' "${checksum_path}")"
  asset_name="$(basename "${asset_path}")"

  if [[ "${actual_sha}" != "${declared_sha}" ]]; then
    echo "checksum file does not match Studio desktop installer: ${checksum_path}" >&2
    echo "asset sha256: ${actual_sha}" >&2
    echo "declared sha256: ${declared_sha}" >&2
    exit 1
  fi

  if [[ -n "${declared_name}" && "${declared_name}" != "${asset_name}" && "${declared_name}" != "./${asset_name}" && "${declared_name}" != "*${asset_name}" ]]; then
    echo "checksum file ${checksum_path} points at ${declared_name}, expected ${asset_name}." >&2
    exit 1
  fi

  printf '%s' "${actual_sha}"
}

content_type_for() {
  local name="$1"
  case "${name}" in
    *.dmg)
      printf 'application/x-apple-diskimage'
      ;;
    *.exe)
      printf 'application/vnd.microsoft.portable-executable'
      ;;
    *.msi)
      printf 'application/x-msi'
      ;;
    *.deb)
      printf 'application/vnd.debian.binary-package'
      ;;
    *.rpm)
      printf 'application/x-rpm'
      ;;
    *.json)
      printf 'application/json'
      ;;
    *)
      printf 'application/octet-stream'
      ;;
  esac
}

if [[ "${dry_run}" != "true" ]]; then
  require_github_actions_publish_context
fi

validate_inputs
require_file "${installer_manifest_path}"
python_bin="$(find_python)"

if [[ "${dry_run}" == "true" ]]; then
  export SKENION_RELEASE_S3_ENDPOINT="${SKENION_RELEASE_S3_ENDPOINT:-https://s3.dsub.io}"
  export SKENION_RELEASE_S3_REGION="${SKENION_RELEASE_S3_REGION:-us-east-1}"
  export SKENION_RELEASE_S3_BUCKET="${SKENION_RELEASE_S3_BUCKET:-skenion}"
  export SKENION_RELEASE_S3_PREFIX="${SKENION_RELEASE_S3_PREFIX:-releases}"
  export SKENION_RELEASE_S3_FORCE_PATH_STYLE="${SKENION_RELEASE_S3_FORCE_PATH_STYLE:-true}"
  export SKENION_RELEASE_PUBLIC_BASE_URL="${SKENION_RELEASE_PUBLIC_BASE_URL:-https://cdn.dsub.io/skenion/releases}"
else
  for env_name in \
    SKENION_RELEASE_S3_ENDPOINT \
    SKENION_RELEASE_S3_REGION \
    SKENION_RELEASE_S3_BUCKET \
    SKENION_RELEASE_S3_PREFIX \
    SKENION_RELEASE_S3_FORCE_PATH_STYLE \
    SKENION_RELEASE_PUBLIC_BASE_URL \
    SKENION_RELEASE_S3_ACCESS_KEY_ID \
    SKENION_RELEASE_S3_SECRET_ACCESS_KEY; do
    require_env "${env_name}"
  done
fi

require_env RUNTIME_TAG
require_env DESKTOP_SIGNING_MODE

source_commit="${SOURCE_COMMIT:-${GITHUB_SHA:-unknown}}"
contracts_version="${CONTRACTS_VERSION:-}"
contracts_line="${CONTRACTS_LINE:-}"
contracts_range="${CONTRACTS_RANGE:-}"
runtime_tag="${RUNTIME_TAG}"
desktop_signing_mode="${DESKTOP_SIGNING_MODE}"
prefix="$(trim_slashes "${SKENION_RELEASE_S3_PREFIX}")"
installer_rows="$(mktemp)"
summary_file="$(mktemp)"
head_json="$(mktemp)"
head_err="$(mktemp)"

cleanup() {
  rm -f "${installer_rows}" "${summary_file}" "${head_json}" "${head_err}"
}
trap cleanup EXIT

"${python_bin}" - "${installer_manifest_path}" "${version}" "${target}" >"${installer_rows}" <<'PY'
import json
import os
import sys

manifest_path, version, target = sys.argv[1:4]
allowed = {
    "aarch64-apple-darwin": {"macos-apple-silicon"},
    "x86_64-apple-darwin": {"macos-intel"},
    "x86_64-pc-windows-msvc": {"windows-x64", "windows-x64-msi"},
    "aarch64-pc-windows-msvc": {"windows-arm64", "windows-arm64-msi"},
    "x86_64-unknown-linux-gnu": {"linux-x64-deb", "linux-x64-rpm"},
    "aarch64-unknown-linux-gnu": {"linux-arm64-deb", "linux-arm64-rpm"},
}

with open(manifest_path, encoding="utf-8") as fh:
    manifest = json.load(fh)

if manifest.get("schema") != "skenion.studio.desktopInstallers.v1":
    raise SystemExit("installer manifest schema must be skenion.studio.desktopInstallers.v1")
if manifest.get("component") != "skenion-studio":
    raise SystemExit("installer manifest component must be skenion-studio")
if manifest.get("studioVersion") != version:
    raise SystemExit(f"installer manifest version {manifest.get('studioVersion')} does not match {version}")
if manifest.get("target") != target:
    raise SystemExit(f"installer manifest target {manifest.get('target')} does not match {target}")

seen = set()
for installer in manifest.get("installers") or []:
    package_id = installer.get("packageId")
    if package_id not in allowed[target]:
        raise SystemExit(f"installer packageId {package_id!r} is not valid for {target}")
    if "unknown-linux-gnu" in package_id or "apple-darwin" in package_id or "pc-windows-msvc" in package_id:
        raise SystemExit(f"installer packageId {package_id!r} exposes an internal target triple")
    if package_id in seen:
        raise SystemExit(f"duplicate installer packageId {package_id}")
    seen.add(package_id)
    filename = installer.get("filename") or ""
    checksum_filename = installer.get("checksumFilename") or ""
    if f"-v{version}-" not in filename:
        raise SystemExit(f"installer filename {filename!r} must include Studio version v{version}")
    if filename.endswith((".tar.gz", ".zip")):
        raise SystemExit(f"installer filename {filename!r} must be a real installer, not a wrapper archive")
    if checksum_filename != f"{filename}.sha256":
        raise SystemExit(f"installer checksum filename {checksum_filename!r} must be {filename}.sha256")
    fields = [
        package_id,
        installer.get("family") or "",
        installer.get("path") or "",
        installer.get("checksumPath") or "",
        filename,
        checksum_filename,
        str(installer.get("size") or ""),
        installer.get("sha256") or "",
    ]
    if any("\t" in value or "\n" in value for value in fields):
        raise SystemExit(f"installer packageId {package_id} contains unsupported tab/newline field data")
    row_ending = "\r\n" if os.environ.get("SKENION_TEST_STUDIO_DESKTOP_INSTALLER_ROWS_CRLF") == "1" else "\n"
    sys.stdout.write("\t".join(fields) + row_ending)

if not seen:
    raise SystemExit("installer manifest must contain at least one installer")
PY

if [[ "${dry_run}" != "true" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required for Studio desktop artifact publishing." >&2
    exit 1
  fi

  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${SKENION_RELEASE_S3_ACCESS_KEY_ID}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${SKENION_RELEASE_S3_SECRET_ACCESS_KEY}}"
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${SKENION_RELEASE_S3_REGION}}"
  export AWS_PAGER=""

  if [[ "${SKENION_RELEASE_S3_FORCE_PATH_STYLE:-}" =~ ^(1|true|TRUE|yes|YES)$ ]]; then
    aws configure set default.s3.addressing_style path
  fi
fi

strict_public_cdn_verify="${SKENION_STRICT_PUBLIC_CDN_VERIFY:-false}"
case "${strict_public_cdn_verify}" in
  1|true|TRUE|yes|YES)
    strict_public_cdn_verify=true
    ;;
  0|false|FALSE|no|NO|"")
    strict_public_cdn_verify=false
    ;;
  *)
    echo "SKENION_STRICT_PUBLIC_CDN_VERIFY must be true or false." >&2
    exit 1
    ;;
esac
if [[ "${strict_public_cdn_verify}" == "true" ]] && ! command -v curl >/dev/null 2>&1; then
  echo "curl is required when SKENION_STRICT_PUBLIC_CDN_VERIFY=true." >&2
  exit 1
fi

read_s3_head_field() {
  local field="$1"
  local path="$2"

  "${python_bin}" - "${field}" "${path}" <<'PY'
import json
import sys

field = sys.argv[1]
with open(sys.argv[2], encoding="utf-8") as fh:
    head = json.load(fh)

metadata = head.get("Metadata") or {}

if field in {"sha256", "component", "artifact-set", "studio-version", "source-tag", "source-commit", "package-id"}:
    print(metadata.get(field, ""))
elif field == "size":
    print(head.get("ContentLength", ""))
else:
    raise SystemExit(f"unsupported head field: {field}")
PY
}

s3_head_metadata_matches_expected() {
  local key="$1"
  local expected_sha="$2"
  local expected_size="$3"
  local package_id="$4"
  local label="$5"
  local actual_sha
  local actual_size
  local actual_component
  local actual_artifact_set
  local actual_version
  local actual_tag
  local actual_commit
  local actual_package_id

  actual_sha="$(read_s3_head_field sha256 "${head_json}")"
  actual_size="$(read_s3_head_field size "${head_json}")"
  actual_component="$(read_s3_head_field component "${head_json}")"
  actual_artifact_set="$(read_s3_head_field artifact-set "${head_json}")"
  actual_version="$(read_s3_head_field studio-version "${head_json}")"
  actual_tag="$(read_s3_head_field source-tag "${head_json}")"
  actual_commit="$(read_s3_head_field source-commit "${head_json}")"
  actual_package_id="$(read_s3_head_field package-id "${head_json}")"

  if [[ "${actual_sha}" == "${expected_sha}" \
    && "${actual_size}" == "${expected_size}" \
    && "${actual_component}" == "skenion-studio" \
    && "${actual_artifact_set}" == "desktop" \
    && "${actual_version}" == "${version}" \
    && "${actual_tag}" == "${release_tag}" \
    && "${actual_commit}" == "${source_commit}" \
    && "${actual_package_id}" == "${package_id}" ]]; then
    return 0
  fi

  echo "Studio desktop release ${label} S3 metadata does not match expected immutable artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
  echo "expected sha256=${expected_sha} size=${expected_size} component=skenion-studio artifact-set=desktop studio-version=${version} source-tag=${release_tag} source-commit=${source_commit} package-id=${package_id}" >&2
  echo "actual sha256=${actual_sha:-<missing>} size=${actual_size:-<missing>} component=${actual_component:-<missing>} artifact-set=${actual_artifact_set:-<missing>} studio-version=${actual_version:-<missing>} source-tag=${actual_tag:-<missing>} source-commit=${actual_commit:-<missing>} package-id=${actual_package_id:-<missing>}" >&2
  return 1
}

s3_existing_object_can_be_reused() {
  local key="$1"
  local expected_sha="$2"
  local expected_size="$3"
  local package_id="$4"
  local actual_sha
  local actual_size
  local actual_component
  local actual_artifact_set
  local actual_version
  local actual_tag
  local actual_commit
  local actual_package_id

  actual_sha="$(read_s3_head_field sha256 "${head_json}")"
  actual_size="$(read_s3_head_field size "${head_json}")"
  actual_component="$(read_s3_head_field component "${head_json}")"
  actual_artifact_set="$(read_s3_head_field artifact-set "${head_json}")"
  actual_version="$(read_s3_head_field studio-version "${head_json}")"
  actual_tag="$(read_s3_head_field source-tag "${head_json}")"
  actual_commit="$(read_s3_head_field source-commit "${head_json}")"
  actual_package_id="$(read_s3_head_field package-id "${head_json}")"

  if [[ "${actual_size}" != "${expected_size}" ]]; then
    echo "Studio desktop release existing S3 object size does not match expected artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    echo "expected size=${expected_size}" >&2
    echo "actual size=${actual_size:-<missing>}" >&2
    return 1
  fi

  if [[ -z "${actual_sha}${actual_component}${actual_artifact_set}${actual_version}${actual_tag}${actual_commit}${actual_package_id}" ]]; then
    echo "object already exists without immutable metadata and matching size: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
    return 0
  fi

  s3_head_metadata_matches_expected "${key}" "${expected_sha}" "${expected_size}" "${package_id}" "existing object"
}

object_exists_with_reusable_metadata() {
  local key="$1"
  local expected_sha="$2"
  local expected_size="$3"
  local package_id="$4"

  : >"${head_err}"
  if aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api head-object \
    --bucket "${SKENION_RELEASE_S3_BUCKET}" \
    --key "${key}" >"${head_json}" 2>"${head_err}"; then
    if s3_existing_object_can_be_reused "${key}" "${expected_sha}" "${expected_size}" "${package_id}"; then
      echo "object already exists and will not be overwritten: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
      return 0
    fi
    echo "refusing to overwrite existing Studio desktop release artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    exit 1
  fi

  if grep -Eiq '(404|Not Found|NoSuchKey|NotFound)' "${head_err}"; then
    return 1
  fi

  if grep -Eiq '(403|Forbidden|AccessDenied)' "${head_err}"; then
    echo "could not inspect Studio desktop release object before upload; proceeding with conditional no-overwrite upload: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
    return 1
  fi

  echo "failed to inspect Studio desktop release artifact object: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
  cat "${head_err}" >&2
  exit 1
}

upload_object() {
  local path="$1"
  local key="$2"
  local sha="$3"
  local size="$4"
  local package_id="$5"
  local content_type="$6"

  if object_exists_with_reusable_metadata "${key}" "${sha}" "${size}" "${package_id}"; then
    return 0
  fi

  : >"${head_err}"
  if ! aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api put-object \
    --bucket "${SKENION_RELEASE_S3_BUCKET}" \
    --key "${key}" \
    --body "${path}" \
    --content-type "${content_type}" \
    --metadata "sha256=${sha},component=skenion-studio,artifact-set=desktop,studio-version=${version},source-tag=${release_tag},source-commit=${source_commit},package-id=${package_id}" \
    --if-none-match '*' >/dev/null 2>"${head_err}"; then
    if grep -Eiq '(PreconditionFailed|precondition failed|HTTP 412|status code: 412)' "${head_err}"; then
      echo "object already exists and will not be overwritten: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
      echo "conditional DSUB S3 upload skipped existing Studio desktop release object without requiring HeadObject permission."
      return 0
    fi
    echo "failed to conditionally upload Studio desktop release artifact without overwriting: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    cat "${head_err}" >&2
    exit 1
  fi

  echo "uploaded Studio desktop release object: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
}

verify_public_content_length() {
  local url="$1"
  local expected_size="$2"
  local label="$3"
  local headers_path
  local actual_size

  headers_path="$(mktemp)"
  if ! curl --fail --silent --show-error --location --head \
    --dump-header "${headers_path}" \
    --output /dev/null \
    "${url}"; then
    rm -f "${headers_path}"
    echo "failed to verify public Studio desktop release ${label}: ${url}" >&2
    exit 1
  fi

  actual_size="$(awk 'BEGIN { IGNORECASE = 1 } /^Content-Length:/ { gsub("\r", "", $2); value = $2 } END { print value }' "${headers_path}")"
  rm -f "${headers_path}"

  if [[ -z "${actual_size}" ]]; then
    echo "public Studio desktop release ${label} is missing Content-Length: ${url}" >&2
    exit 1
  fi

  if [[ "${actual_size}" != "${expected_size}" ]]; then
    echo "public Studio desktop release ${label} Content-Length does not match local file: ${url}" >&2
    echo "expected size=${expected_size}" >&2
    echo "actual size=${actual_size:-<missing>}" >&2
    exit 1
  fi
}

verify_public_file_matches() {
  local url="$1"
  local expected_path="$2"
  local label="$3"
  local body_path
  local expected_sha
  local actual_sha

  body_path="$(mktemp)"
  if ! curl --fail --silent --show-error --location \
    --output "${body_path}" \
    "${url}"; then
    rm -f "${body_path}"
    echo "failed to download public Studio desktop release ${label}: ${url}" >&2
    exit 1
  fi

  if ! cmp -s "${expected_path}" "${body_path}"; then
    expected_sha="$(sha256_file "${expected_path}")"
    actual_sha="$(sha256_file "${body_path}")"
    rm -f "${body_path}"
    echo "public Studio desktop release ${label} content does not match local file: ${url}" >&2
    echo "expected sha256=${expected_sha:-<missing>}" >&2
    echo "actual sha256=${actual_sha:-<missing>}" >&2
    exit 1
  fi

  rm -f "${body_path}"
}

while IFS=$'\t' read -r package_id family asset_path checksum_path asset_name checksum_name manifest_size manifest_sha; do
  # Windows runners can preserve CRLF on the final TSV field emitted by Python.
  package_id="${package_id%$'\r'}"
  family="${family%$'\r'}"
  asset_path="${asset_path%$'\r'}"
  checksum_path="${checksum_path%$'\r'}"
  asset_name="${asset_name%$'\r'}"
  checksum_name="${checksum_name%$'\r'}"
  manifest_size="${manifest_size%$'\r'}"
  manifest_sha="${manifest_sha%$'\r'}"

  require_file "${asset_path}"
  require_file "${checksum_path}"

  asset_sha="$(verify_checksum_file "${asset_path}" "${checksum_path}")"
  asset_size="$(file_size "${asset_path}")"
  if [[ -n "${manifest_sha}" && "${manifest_sha}" != "${asset_sha}" ]]; then
    echo "installer manifest sha256 for ${package_id} does not match ${asset_path}." >&2
    exit 1
  fi
  if [[ -n "${manifest_size}" && "${manifest_size}" != "${asset_size}" ]]; then
    echo "installer manifest size for ${package_id} does not match ${asset_path}." >&2
    exit 1
  fi

  checksum_sha="$(sha256_file "${checksum_path}")"
  checksum_size="$(file_size "${checksum_path}")"
  artifact_dir="$(join_key "${prefix}" "skenion-studio/${release_tag}/desktop/${package_id}")"
  asset_key="$(join_key "${artifact_dir}" "${asset_name}")"
  checksum_key="$(join_key "${artifact_dir}" "${checksum_name}")"
  index_name="skenion-studio-desktop-${package_id}-v${version}.index.json"
  index_path="$(dirname "${asset_path}")/${index_name}"
  index_key="$(join_key "${artifact_dir}" "${index_name}")"
  asset_url="$(public_url "$(relative_public_key "${prefix}" "${asset_key}")")"
  checksum_url="$(public_url "$(relative_public_key "${prefix}" "${checksum_key}")")"
  index_url="$(public_url "$(relative_public_key "${prefix}" "${index_key}")")"

  export STUDIO_DESKTOP_SCHEMA="skenion.studio.desktopPackage.v1"
  export STUDIO_DESKTOP_COMPONENT="skenion-studio"
  export STUDIO_DESKTOP_VERSION="${version}"
  export STUDIO_DESKTOP_TAG="${release_tag}"
  export STUDIO_DESKTOP_SOURCE_COMMIT="${source_commit}"
  export STUDIO_DESKTOP_PACKAGE_ID="${package_id}"
  export STUDIO_DESKTOP_FAMILY="${family}"
  export STUDIO_DESKTOP_TIER="${tier}"
  export STUDIO_DESKTOP_CONTRACTS_VERSION="${contracts_version}"
  export STUDIO_DESKTOP_CONTRACTS_LINE="${contracts_line}"
  export STUDIO_DESKTOP_CONTRACTS_RANGE="${contracts_range}"
  export STUDIO_DESKTOP_RUNTIME_TAG="${runtime_tag}"
  export STUDIO_DESKTOP_SIGNING_MODE="${desktop_signing_mode}"
  export STUDIO_DESKTOP_BUCKET="${SKENION_RELEASE_S3_BUCKET}"
  export STUDIO_DESKTOP_ASSET_NAME="${asset_name}"
  export STUDIO_DESKTOP_ASSET_KEY="${asset_key}"
  export STUDIO_DESKTOP_ASSET_URL="${asset_url}"
  export STUDIO_DESKTOP_ASSET_SHA256="${asset_sha}"
  export STUDIO_DESKTOP_ASSET_SIZE="${asset_size}"
  export STUDIO_DESKTOP_CHECKSUM_NAME="${checksum_name}"
  export STUDIO_DESKTOP_CHECKSUM_KEY="${checksum_key}"
  export STUDIO_DESKTOP_CHECKSUM_URL="${checksum_url}"
  export STUDIO_DESKTOP_CHECKSUM_SHA256="${checksum_sha}"
  export STUDIO_DESKTOP_CHECKSUM_SIZE="${checksum_size}"
  export STUDIO_DESKTOP_INDEX_NAME="${index_name}"
  export STUDIO_DESKTOP_INDEX_KEY="${index_key}"
  export STUDIO_DESKTOP_INDEX_URL="${index_url}"

  "${python_bin}" - "${index_path}" <<'PY'
import json
import os
import sys

def optional(value):
    return value or None

manifest = {
    "schema": os.environ["STUDIO_DESKTOP_SCHEMA"],
    "component": os.environ["STUDIO_DESKTOP_COMPONENT"],
    "studioVersion": os.environ["STUDIO_DESKTOP_VERSION"],
    "releaseTag": os.environ["STUDIO_DESKTOP_TAG"],
    "sourceCommit": os.environ["STUDIO_DESKTOP_SOURCE_COMMIT"],
    "packageId": os.environ["STUDIO_DESKTOP_PACKAGE_ID"],
    "family": os.environ["STUDIO_DESKTOP_FAMILY"],
    "tier": os.environ["STUDIO_DESKTOP_TIER"],
    "contracts": {
        "version": optional(os.environ.get("STUDIO_DESKTOP_CONTRACTS_VERSION", "")),
        "line": optional(os.environ.get("STUDIO_DESKTOP_CONTRACTS_LINE", "")),
        "range": optional(os.environ.get("STUDIO_DESKTOP_CONTRACTS_RANGE", "")),
    },
    "runtime": {
        "releaseTag": os.environ["STUDIO_DESKTOP_RUNTIME_TAG"],
        "binarySource": "skenion-runtime-release-manifest",
    },
    "signing": {
        "mode": os.environ["STUDIO_DESKTOP_SIGNING_MODE"],
    },
    "distribution": {
        "storage": "dsub-s3",
        "publicBaseUrl": os.environ["SKENION_RELEASE_PUBLIC_BASE_URL"],
    },
    "desktopInstaller": {
        "filename": os.environ["STUDIO_DESKTOP_ASSET_NAME"],
        "sha256": os.environ["STUDIO_DESKTOP_ASSET_SHA256"],
        "size": int(os.environ["STUDIO_DESKTOP_ASSET_SIZE"]),
        "s3": {
            "bucket": os.environ["STUDIO_DESKTOP_BUCKET"],
            "key": os.environ["STUDIO_DESKTOP_ASSET_KEY"],
        },
        "publicUrl": os.environ["STUDIO_DESKTOP_ASSET_URL"],
    },
    "checksum": {
        "filename": os.environ["STUDIO_DESKTOP_CHECKSUM_NAME"],
        "sha256": os.environ["STUDIO_DESKTOP_CHECKSUM_SHA256"],
        "size": int(os.environ["STUDIO_DESKTOP_CHECKSUM_SIZE"]),
        "s3": {
            "bucket": os.environ["STUDIO_DESKTOP_BUCKET"],
            "key": os.environ["STUDIO_DESKTOP_CHECKSUM_KEY"],
        },
        "publicUrl": os.environ["STUDIO_DESKTOP_CHECKSUM_URL"],
    },
    "index": {
        "filename": os.environ["STUDIO_DESKTOP_INDEX_NAME"],
        "s3": {
            "bucket": os.environ["STUDIO_DESKTOP_BUCKET"],
            "key": os.environ["STUDIO_DESKTOP_INDEX_KEY"],
        },
        "publicUrl": os.environ["STUDIO_DESKTOP_INDEX_URL"],
    },
}

with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY

  index_sha="$(sha256_file "${index_path}")"
  index_size="$(file_size "${index_path}")"

  if [[ "${dry_run}" == "true" ]]; then
    echo "dry run: would publish Studio desktop installer to ${asset_url}"
    echo "dry run: would publish Studio desktop checksum to ${checksum_url}"
    echo "dry run: would publish Studio desktop index to ${index_url}"
  else
    upload_object "${asset_path}" "${asset_key}" "${asset_sha}" "${asset_size}" "${package_id}" "$(content_type_for "${asset_name}")"
    upload_object "${checksum_path}" "${checksum_key}" "${checksum_sha}" "${checksum_size}" "${package_id}" "text/plain"
    upload_object "${index_path}" "${index_key}" "${index_sha}" "${index_size}" "${package_id}" "application/json"

    if [[ "${strict_public_cdn_verify}" == "true" ]]; then
      verify_public_content_length "${asset_url}" "${asset_size}" "desktop installer ${asset_name}"
      verify_public_content_length "${checksum_url}" "${checksum_size}" "desktop checksum ${checksum_name}"
      verify_public_content_length "${index_url}" "${index_size}" "desktop index ${index_name}"
      verify_public_file_matches "${asset_url}" "${asset_path}" "desktop installer ${asset_name}"
      verify_public_file_matches "${checksum_url}" "${checksum_path}" "desktop checksum ${checksum_name}"
      verify_public_file_matches "${index_url}" "${index_path}" "desktop index ${index_name}"
    else
      echo "public CDN verification skipped by default after successful DSUB S3 upload; public URLs remain in the Studio desktop artifact index: ${index_url}"
    fi
  fi

  printf -- '- %s: %s (checksum: %s)\n' "${package_id}" "${asset_url}" "${checksum_url}" >>"${summary_file}"
done <"${installer_rows}"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "desktop_artifact_summary<<SKENION_DESKTOP_ARTIFACTS"
    cat "${summary_file}"
    echo "SKENION_DESKTOP_ARTIFACTS"
  } >>"${GITHUB_OUTPUT}"
fi
