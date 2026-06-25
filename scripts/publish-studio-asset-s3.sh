#!/usr/bin/env bash
set -euo pipefail

dry_run=false
use_existing_manifest=false
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --dry-run)
      dry_run=true
      ;;
    --use-existing-manifest)
      use_existing_manifest=true
      ;;
    *)
      echo "unknown option: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [[ $# -ne 7 ]]; then
  echo "usage: $0 [--dry-run] [--use-existing-manifest] <version> <release-tag> <web-asset-path> <web-checksum-path> <desktop-manifest-path> <desktop-manifest-checksum-path> <combined-checksum-path>" >&2
  exit 2
fi

version="$1"
release_tag="$2"
web_asset_path="$3"
web_checksum_path="$4"
desktop_manifest_path="$5"
desktop_manifest_checksum_path="$6"
combined_checksum_path="$7"

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
  elif command -v python >/dev/null 2>&1; then
    command -v python
  else
    echo "python3 or python is required for Studio release metadata generation." >&2
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
    echo "Studio release artifact publishing must run from GitHub Actions." >&2
    exit 1
  fi

  if [[ "${GITHUB_EVENT_NAME:-}" != "workflow_dispatch" ]]; then
    echo "Studio release artifact publishing is only allowed for workflow_dispatch events." >&2
    exit 1
  fi
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
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${path}" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${path}" | awk '{print $1}'
  else
    echo "no sha256 checksum tool found" >&2
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

validate_semver_inputs() {
  if [[ ! "${version}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "version must use x.y.z SemVer form; got '${version}'." >&2
    exit 1
  fi

  if [[ "${release_tag}" != "v${version}" ]]; then
    echo "release tag ${release_tag} must match v${version}." >&2
    exit 1
  fi
}

verify_checksum_file() {
  local asset_path="$1"
  local checksum_path="$2"
  local label="$3"
  local actual_sha
  local declared_sha

  actual_sha="$(sha256_file "${asset_path}")"
  declared_sha="$(awk '{print $1; exit}' "${checksum_path}")"

  if [[ "${actual_sha}" != "${declared_sha}" ]]; then
    echo "checksum file does not match ${label}: ${checksum_path}" >&2
    echo "asset sha256: ${actual_sha}" >&2
    echo "declared sha256: ${declared_sha}" >&2
    exit 1
  fi

  printf '%s' "${actual_sha}"
}

verify_combined_checksum_entry() {
  local asset_path="$1"
  local expected_sha="$2"
  local checksum_path="$3"
  local asset_name

  asset_name="$(basename "${asset_path}")"
  if ! awk -v expected_sha="${expected_sha}" -v asset_name="${asset_name}" '
    $1 == expected_sha && ($2 == asset_name || $2 == "./" asset_name || $2 == "*" asset_name) { found = 1 }
    END { exit(found ? 0 : 1) }
  ' "${checksum_path}"; then
    echo "combined checksum manifest does not contain ${asset_name} with sha256 ${expected_sha}: ${checksum_path}" >&2
    exit 1
  fi
}

if [[ "${dry_run}" != "true" ]]; then
  require_github_actions_publish_context
fi

validate_semver_inputs
require_file "${web_asset_path}"
require_file "${web_checksum_path}"
require_file "${desktop_manifest_path}"
require_file "${desktop_manifest_checksum_path}"
require_file "${combined_checksum_path}"
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

web_asset_name="$(basename "${web_asset_path}")"
web_checksum_name="$(basename "${web_checksum_path}")"
desktop_manifest_name="$(basename "${desktop_manifest_path}")"
desktop_manifest_checksum_name="$(basename "${desktop_manifest_checksum_path}")"
combined_checksum_name="$(basename "${combined_checksum_path}")"
index_name="skenion-studio-web-artifacts-v${version}.index.json"
index_path="$(dirname "${web_asset_path}")/${index_name}"
source_commit="${SOURCE_COMMIT:-${GITHUB_SHA:-unknown}}"
contracts_version="${CONTRACTS_VERSION:-}"
contracts_line="${CONTRACTS_LINE:-}"
contracts_range="${CONTRACTS_RANGE:-}"
runtime_tag="${RUNTIME_TAG:-}"

web_asset_sha="$(verify_checksum_file "${web_asset_path}" "${web_checksum_path}" "Studio web bundle")"
desktop_manifest_sha="$(verify_checksum_file "${desktop_manifest_path}" "${desktop_manifest_checksum_path}" "Studio desktop manifest")"
verify_combined_checksum_entry "${web_asset_path}" "${web_asset_sha}" "${combined_checksum_path}"
verify_combined_checksum_entry "${desktop_manifest_path}" "${desktop_manifest_sha}" "${combined_checksum_path}"

web_asset_size="$(file_size "${web_asset_path}")"
web_checksum_sha="$(sha256_file "${web_checksum_path}")"
web_checksum_size="$(file_size "${web_checksum_path}")"
desktop_manifest_size="$(file_size "${desktop_manifest_path}")"
desktop_manifest_checksum_sha="$(sha256_file "${desktop_manifest_checksum_path}")"
desktop_manifest_checksum_size="$(file_size "${desktop_manifest_checksum_path}")"
combined_checksum_sha="$(sha256_file "${combined_checksum_path}")"
combined_checksum_size="$(file_size "${combined_checksum_path}")"

prefix="$(trim_slashes "${SKENION_RELEASE_S3_PREFIX}")"
artifact_dir="$(join_key "${prefix}" "skenion-studio/${release_tag}/web")"
web_asset_key="$(join_key "${artifact_dir}" "${web_asset_name}")"
web_checksum_key="$(join_key "${artifact_dir}" "${web_checksum_name}")"
desktop_manifest_key="$(join_key "${artifact_dir}" "${desktop_manifest_name}")"
desktop_manifest_checksum_key="$(join_key "${artifact_dir}" "${desktop_manifest_checksum_name}")"
combined_checksum_key="$(join_key "${artifact_dir}" "${combined_checksum_name}")"
index_key="$(join_key "${artifact_dir}" "${index_name}")"
web_asset_url="$(public_url "$(relative_public_key "${prefix}" "${web_asset_key}")")"
web_checksum_url="$(public_url "$(relative_public_key "${prefix}" "${web_checksum_key}")")"
desktop_manifest_url="$(public_url "$(relative_public_key "${prefix}" "${desktop_manifest_key}")")"
desktop_manifest_checksum_url="$(public_url "$(relative_public_key "${prefix}" "${desktop_manifest_checksum_key}")")"
combined_checksum_url="$(public_url "$(relative_public_key "${prefix}" "${combined_checksum_key}")")"
index_url="$(public_url "$(relative_public_key "${prefix}" "${index_key}")")"

export STUDIO_RELEASE_SCHEMA="skenion.studio.webArtifacts.v1"
export STUDIO_RELEASE_COMPONENT="skenion-studio"
export STUDIO_RELEASE_VERSION="${version}"
export STUDIO_RELEASE_TAG="${release_tag}"
export STUDIO_RELEASE_SOURCE_COMMIT="${source_commit}"
export STUDIO_RELEASE_CONTRACTS_VERSION="${contracts_version}"
export STUDIO_RELEASE_CONTRACTS_LINE="${contracts_line}"
export STUDIO_RELEASE_CONTRACTS_RANGE="${contracts_range}"
export STUDIO_RELEASE_RUNTIME_TAG="${runtime_tag}"
export STUDIO_RELEASE_BUCKET="${SKENION_RELEASE_S3_BUCKET}"
export STUDIO_RELEASE_WEB_ASSET_NAME="${web_asset_name}"
export STUDIO_RELEASE_WEB_ASSET_KEY="${web_asset_key}"
export STUDIO_RELEASE_WEB_ASSET_URL="${web_asset_url}"
export STUDIO_RELEASE_WEB_ASSET_SHA256="${web_asset_sha}"
export STUDIO_RELEASE_WEB_ASSET_SIZE="${web_asset_size}"
export STUDIO_RELEASE_WEB_CHECKSUM_NAME="${web_checksum_name}"
export STUDIO_RELEASE_WEB_CHECKSUM_KEY="${web_checksum_key}"
export STUDIO_RELEASE_WEB_CHECKSUM_URL="${web_checksum_url}"
export STUDIO_RELEASE_WEB_CHECKSUM_SHA256="${web_checksum_sha}"
export STUDIO_RELEASE_WEB_CHECKSUM_SIZE="${web_checksum_size}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_NAME="${desktop_manifest_name}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_KEY="${desktop_manifest_key}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_URL="${desktop_manifest_url}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_SHA256="${desktop_manifest_sha}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_SIZE="${desktop_manifest_size}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_NAME="${desktop_manifest_checksum_name}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_KEY="${desktop_manifest_checksum_key}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_URL="${desktop_manifest_checksum_url}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_SHA256="${desktop_manifest_checksum_sha}"
export STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_SIZE="${desktop_manifest_checksum_size}"
export STUDIO_RELEASE_COMBINED_CHECKSUM_NAME="${combined_checksum_name}"
export STUDIO_RELEASE_COMBINED_CHECKSUM_KEY="${combined_checksum_key}"
export STUDIO_RELEASE_COMBINED_CHECKSUM_URL="${combined_checksum_url}"
export STUDIO_RELEASE_COMBINED_CHECKSUM_SHA256="${combined_checksum_sha}"
export STUDIO_RELEASE_COMBINED_CHECKSUM_SIZE="${combined_checksum_size}"
export STUDIO_RELEASE_INDEX_NAME="${index_name}"
export STUDIO_RELEASE_INDEX_KEY="${index_key}"
export STUDIO_RELEASE_INDEX_URL="${index_url}"

write_index() {
  local output_path="$1"

  "${python_bin}" - "${output_path}" <<'PY'
import json
import os
import sys

def optional(value):
    return value or None

def asset(role, name_key, key_key, url_key, sha_key, size_key):
    return {
        "role": role,
        "filename": os.environ[name_key],
        "sha256": os.environ[sha_key],
        "size": int(os.environ[size_key]),
        "s3": {
            "bucket": os.environ["STUDIO_RELEASE_BUCKET"],
            "key": os.environ[key_key],
        },
        "publicUrl": os.environ[url_key],
    }

manifest = {
    "schema": os.environ["STUDIO_RELEASE_SCHEMA"],
    "component": os.environ["STUDIO_RELEASE_COMPONENT"],
    "studioVersion": os.environ["STUDIO_RELEASE_VERSION"],
    "releaseTag": os.environ["STUDIO_RELEASE_TAG"],
    "sourceCommit": os.environ["STUDIO_RELEASE_SOURCE_COMMIT"],
    "contracts": {
        "version": optional(os.environ.get("STUDIO_RELEASE_CONTRACTS_VERSION", "")),
        "line": optional(os.environ.get("STUDIO_RELEASE_CONTRACTS_LINE", "")),
        "range": optional(os.environ.get("STUDIO_RELEASE_CONTRACTS_RANGE", "")),
    },
    "runtime": {
        "releaseTag": optional(os.environ.get("STUDIO_RELEASE_RUNTIME_TAG", "")),
        "binarySource": "skenion-runtime-release-manifest",
        "bundledByStudioWebArtifacts": False,
    },
    "distribution": {
        "storage": "dsub-s3",
        "publicBaseUrl": os.environ["SKENION_RELEASE_PUBLIC_BASE_URL"],
    },
    "assets": [
        asset(
            "web-bundle",
            "STUDIO_RELEASE_WEB_ASSET_NAME",
            "STUDIO_RELEASE_WEB_ASSET_KEY",
            "STUDIO_RELEASE_WEB_ASSET_URL",
            "STUDIO_RELEASE_WEB_ASSET_SHA256",
            "STUDIO_RELEASE_WEB_ASSET_SIZE",
        ),
        asset(
            "web-bundle-checksum",
            "STUDIO_RELEASE_WEB_CHECKSUM_NAME",
            "STUDIO_RELEASE_WEB_CHECKSUM_KEY",
            "STUDIO_RELEASE_WEB_CHECKSUM_URL",
            "STUDIO_RELEASE_WEB_CHECKSUM_SHA256",
            "STUDIO_RELEASE_WEB_CHECKSUM_SIZE",
        ),
        asset(
            "desktop-manifest",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_NAME",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_KEY",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_URL",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_SHA256",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_SIZE",
        ),
        asset(
            "desktop-manifest-checksum",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_NAME",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_KEY",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_URL",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_SHA256",
            "STUDIO_RELEASE_DESKTOP_MANIFEST_CHECKSUM_SIZE",
        ),
        asset(
            "combined-checksum",
            "STUDIO_RELEASE_COMBINED_CHECKSUM_NAME",
            "STUDIO_RELEASE_COMBINED_CHECKSUM_KEY",
            "STUDIO_RELEASE_COMBINED_CHECKSUM_URL",
            "STUDIO_RELEASE_COMBINED_CHECKSUM_SHA256",
            "STUDIO_RELEASE_COMBINED_CHECKSUM_SIZE",
        ),
    ],
    "index": {
        "filename": os.environ["STUDIO_RELEASE_INDEX_NAME"],
        "s3": {
            "bucket": os.environ["STUDIO_RELEASE_BUCKET"],
            "key": os.environ["STUDIO_RELEASE_INDEX_KEY"],
        },
        "publicUrl": os.environ["STUDIO_RELEASE_INDEX_URL"],
    },
}

with open(sys.argv[1], "w", encoding="utf-8") as fh:
    json.dump(manifest, fh, indent=2, sort_keys=True)
    fh.write("\n")
PY
}

if [[ "${use_existing_manifest}" == "true" ]]; then
  require_file "${index_path}"
  expected_index_path="$(mktemp)"
  write_index "${expected_index_path}"
  if ! cmp -s "${index_path}" "${expected_index_path}"; then
    rm -f "${expected_index_path}"
    echo "existing Studio release index does not match current release inputs: ${index_path}" >&2
    exit 1
  fi
  rm -f "${expected_index_path}"
else
  write_index "${index_path}"
fi

index_sha="$(sha256_file "${index_path}")"
index_size="$(file_size "${index_path}")"

if [[ "${dry_run}" == "true" ]]; then
  echo "dry run: would publish Studio web bundle to ${web_asset_url}"
  echo "dry run: would publish Studio web checksum to ${web_checksum_url}"
  echo "dry run: would publish Studio desktop manifest to ${desktop_manifest_url}"
  echo "dry run: would publish Studio desktop manifest checksum to ${desktop_manifest_checksum_url}"
  echo "dry run: would publish Studio combined checksum to ${combined_checksum_url}"
  echo "dry run: would publish Studio web artifact index to ${index_url}"
else
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required for Studio release artifact publishing." >&2
    exit 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for Studio release artifact public-read verification." >&2
    exit 1
  fi

  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-${SKENION_RELEASE_S3_ACCESS_KEY_ID}}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-${SKENION_RELEASE_S3_SECRET_ACCESS_KEY}}"
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${SKENION_RELEASE_S3_REGION}}"
  export AWS_PAGER=""

  if [[ "${SKENION_RELEASE_S3_FORCE_PATH_STYLE:-}" =~ ^(1|true|TRUE|yes|YES)$ ]]; then
    aws configure set default.s3.addressing_style path
  fi

  public_verify_attempts="${SKENION_PUBLIC_VERIFY_ATTEMPTS:-12}"
  public_verify_sleep_seconds="${SKENION_PUBLIC_VERIFY_SLEEP_SECONDS:-5}"
  if [[ ! "${public_verify_attempts}" =~ ^[1-9][0-9]*$ ]]; then
    echo "SKENION_PUBLIC_VERIFY_ATTEMPTS must be a positive integer." >&2
    exit 1
  fi
  if [[ ! "${public_verify_sleep_seconds}" =~ ^[0-9]+$ ]]; then
    echo "SKENION_PUBLIC_VERIFY_SLEEP_SECONDS must be a non-negative integer." >&2
    exit 1
  fi

  head_json="$(mktemp)"
  head_err="$(mktemp)"
  cleanup_head() {
    rm -f "${head_json}" "${head_err}"
  }
  trap cleanup_head EXIT

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

if field in {"sha256", "component", "artifact-set", "studio-version", "source-tag", "source-commit"}:
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
    local label="$4"
    local actual_sha
    local actual_size
    local actual_component
    local actual_artifact_set
    local actual_version
    local actual_tag
    local actual_commit

    actual_sha="$(read_s3_head_field sha256 "${head_json}")"
    actual_size="$(read_s3_head_field size "${head_json}")"
    actual_component="$(read_s3_head_field component "${head_json}")"
    actual_artifact_set="$(read_s3_head_field artifact-set "${head_json}")"
    actual_version="$(read_s3_head_field studio-version "${head_json}")"
    actual_tag="$(read_s3_head_field source-tag "${head_json}")"
    actual_commit="$(read_s3_head_field source-commit "${head_json}")"

    if [[ "${actual_sha}" == "${expected_sha}" \
      && "${actual_size}" == "${expected_size}" \
      && "${actual_component}" == "skenion-studio" \
      && "${actual_artifact_set}" == "web" \
      && "${actual_version}" == "${version}" \
      && "${actual_tag}" == "${release_tag}" \
      && "${actual_commit}" == "${source_commit}" ]]; then
      return 0
    fi

    echo "Studio release ${label} S3 metadata does not match expected immutable artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    echo "expected sha256=${expected_sha} size=${expected_size} component=skenion-studio artifact-set=web studio-version=${version} source-tag=${release_tag} source-commit=${source_commit}" >&2
    echo "actual sha256=${actual_sha:-<missing>} size=${actual_size:-<missing>} component=${actual_component:-<missing>} artifact-set=${actual_artifact_set:-<missing>} studio-version=${actual_version:-<missing>} source-tag=${actual_tag:-<missing>} source-commit=${actual_commit:-<missing>}" >&2
    return 1
  }

  s3_existing_object_can_be_reused() {
    local key="$1"
    local expected_sha="$2"
    local expected_size="$3"
    local actual_sha
    local actual_size
    local actual_component
    local actual_artifact_set
    local actual_version
    local actual_tag
    local actual_commit

    actual_sha="$(read_s3_head_field sha256 "${head_json}")"
    actual_size="$(read_s3_head_field size "${head_json}")"
    actual_component="$(read_s3_head_field component "${head_json}")"
    actual_artifact_set="$(read_s3_head_field artifact-set "${head_json}")"
    actual_version="$(read_s3_head_field studio-version "${head_json}")"
    actual_tag="$(read_s3_head_field source-tag "${head_json}")"
    actual_commit="$(read_s3_head_field source-commit "${head_json}")"

    if [[ "${actual_size}" != "${expected_size}" ]]; then
      echo "Studio release existing S3 object size does not match expected artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
      echo "expected size=${expected_size}" >&2
      echo "actual size=${actual_size:-<missing>}" >&2
      return 1
    fi

    if [[ -z "${actual_sha}${actual_component}${actual_artifact_set}${actual_version}${actual_tag}${actual_commit}" ]]; then
      echo "object already exists without immutable metadata and matching size: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
      return 0
    fi

    s3_head_metadata_matches_expected "${key}" "${expected_sha}" "${expected_size}" "existing object"
  }

  object_exists_with_same_metadata() {
    local key="$1"
    local expected_sha="$2"
    local expected_size="$3"

    if aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api head-object \
      --bucket "${SKENION_RELEASE_S3_BUCKET}" \
      --key "${key}" >"${head_json}" 2>"${head_err}"; then
      if s3_existing_object_can_be_reused "${key}" "${expected_sha}" "${expected_size}"; then
        echo "object already exists and will not be overwritten: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
        return 0
      fi
      echo "refusing to overwrite existing Studio release artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
      exit 1
    fi

    if grep -Eiq '(404|Not Found|NoSuchKey|NotFound)' "${head_err}"; then
      return 1
    fi

    echo "failed to inspect release artifact object: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    cat "${head_err}" >&2
    exit 1
  }

  upload_object() {
    local path="$1"
    local key="$2"
    local sha="$3"
    local size="$4"
    local content_type="$5"

    if object_exists_with_same_metadata "${key}" "${sha}" "${size}"; then
      return 0
    fi

    if ! aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api put-object \
      --bucket "${SKENION_RELEASE_S3_BUCKET}" \
      --key "${key}" \
      --body "${path}" \
      --content-type "${content_type}" \
      --metadata "sha256=${sha},component=skenion-studio,artifact-set=web,studio-version=${version},source-tag=${release_tag},source-commit=${source_commit}" \
      --if-none-match '*' >/dev/null 2>"${head_err}"; then
      echo "failed to conditionally upload Studio release artifact without overwriting: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
      cat "${head_err}" >&2
      exit 1
    fi

    echo "uploaded Studio release object: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
  }

  public_verify_failure=""
  public_verify_actual_size=""
  public_verify_expected_sha=""
  public_verify_actual_sha=""

  maybe_sleep_before_public_retry() {
    if ((public_verify_sleep_seconds > 0)); then
      sleep "${public_verify_sleep_seconds}"
    fi
  }

  verify_public_content_length_attempt() {
    local url="$1"
    local expected_size="$2"
    local headers_path
    local actual_size

    public_verify_failure=""
    public_verify_actual_size=""

    headers_path="$(mktemp)"
    if ! curl --fail --silent --show-error --location --head \
      --dump-header "${headers_path}" \
      --output /dev/null \
      "${url}"; then
      rm -f "${headers_path}"
      public_verify_failure="HEAD request failed"
      return 1
    fi

    actual_size="$(awk 'BEGIN { IGNORECASE = 1 } /^Content-Length:/ { gsub("\r", "", $2); value = $2 } END { print value }' "${headers_path}")"
    rm -f "${headers_path}"

    if [[ -z "${actual_size}" ]]; then
      public_verify_failure="missing Content-Length"
      return 1
    fi

    if [[ "${actual_size}" != "${expected_size}" ]]; then
      public_verify_failure="Content-Length mismatch"
      public_verify_actual_size="${actual_size}"
      return 1
    fi
  }

  verify_public_content_length() {
    local url="$1"
    local expected_size="$2"
    local label="$3"
    local attempt

    for ((attempt = 1; attempt <= public_verify_attempts; attempt++)); do
      if verify_public_content_length_attempt "${url}" "${expected_size}"; then
        return 0
      fi

      if ((attempt < public_verify_attempts)); then
        echo "public Studio release ${label} is not ready on attempt ${attempt}/${public_verify_attempts}: ${public_verify_failure}; retrying in ${public_verify_sleep_seconds}s: ${url}" >&2
        maybe_sleep_before_public_retry
      fi
    done

    if [[ "${public_verify_failure}" == "HEAD request failed" ]]; then
      echo "failed to verify public Studio release ${label}: ${url}" >&2
    elif [[ "${public_verify_failure}" == "missing Content-Length" ]]; then
      echo "public Studio release ${label} is missing Content-Length: ${url}" >&2
    else
      echo "public Studio release ${label} Content-Length does not match local file: ${url}" >&2
      echo "expected size=${expected_size}" >&2
      echo "actual size=${public_verify_actual_size:-<missing>}" >&2
    fi
    exit 1
  }

  verify_public_file_matches_attempt() {
    local url="$1"
    local expected_path="$2"
    local body_path
    local expected_sha
    local actual_sha

    public_verify_failure=""
    public_verify_expected_sha=""
    public_verify_actual_sha=""

    body_path="$(mktemp)"
    if ! curl --fail --silent --show-error --location \
      --output "${body_path}" \
      "${url}"; then
      rm -f "${body_path}"
      public_verify_failure="GET request failed"
      return 1
    fi

    if ! cmp -s "${expected_path}" "${body_path}"; then
      expected_sha="$(sha256_file "${expected_path}")"
      actual_sha="$(sha256_file "${body_path}")"
      rm -f "${body_path}"
      public_verify_failure="content mismatch"
      public_verify_expected_sha="${expected_sha}"
      public_verify_actual_sha="${actual_sha}"
      return 1
    fi

    rm -f "${body_path}"
  }

  verify_public_file_matches() {
    local url="$1"
    local expected_path="$2"
    local label="$3"
    local attempt

    for ((attempt = 1; attempt <= public_verify_attempts; attempt++)); do
      if verify_public_file_matches_attempt "${url}" "${expected_path}"; then
        return 0
      fi

      if ((attempt < public_verify_attempts)); then
        echo "public Studio release ${label} is not ready on attempt ${attempt}/${public_verify_attempts}: ${public_verify_failure}; retrying in ${public_verify_sleep_seconds}s: ${url}" >&2
        maybe_sleep_before_public_retry
      fi
    done

    if [[ "${public_verify_failure}" == "GET request failed" ]]; then
      echo "failed to download public Studio release ${label}: ${url}" >&2
    else
      echo "public Studio release ${label} content does not match local file: ${url}" >&2
      echo "expected sha256=${public_verify_expected_sha:-<missing>}" >&2
      echo "actual sha256=${public_verify_actual_sha:-<missing>}" >&2
    fi
    exit 1
  }

  upload_object "${web_asset_path}" "${web_asset_key}" "${web_asset_sha}" "${web_asset_size}" "application/gzip"
  upload_object "${web_checksum_path}" "${web_checksum_key}" "${web_checksum_sha}" "${web_checksum_size}" "text/plain"
  upload_object "${desktop_manifest_path}" "${desktop_manifest_key}" "${desktop_manifest_sha}" "${desktop_manifest_size}" "application/json"
  upload_object "${desktop_manifest_checksum_path}" "${desktop_manifest_checksum_key}" "${desktop_manifest_checksum_sha}" "${desktop_manifest_checksum_size}" "text/plain"
  upload_object "${combined_checksum_path}" "${combined_checksum_key}" "${combined_checksum_sha}" "${combined_checksum_size}" "text/plain"
  upload_object "${index_path}" "${index_key}" "${index_sha}" "${index_size}" "application/json"

  verify_public_content_length "${web_asset_url}" "${web_asset_size}" "web bundle ${web_asset_name}"
  verify_public_content_length "${web_checksum_url}" "${web_checksum_size}" "web checksum ${web_checksum_name}"
  verify_public_content_length "${desktop_manifest_url}" "${desktop_manifest_size}" "desktop manifest ${desktop_manifest_name}"
  verify_public_content_length "${desktop_manifest_checksum_url}" "${desktop_manifest_checksum_size}" "desktop manifest checksum ${desktop_manifest_checksum_name}"
  verify_public_content_length "${combined_checksum_url}" "${combined_checksum_size}" "combined checksum ${combined_checksum_name}"
  verify_public_content_length "${index_url}" "${index_size}" "web artifact index ${index_name}"
  verify_public_file_matches "${web_asset_url}" "${web_asset_path}" "web bundle ${web_asset_name}"
  verify_public_file_matches "${web_checksum_url}" "${web_checksum_path}" "web checksum ${web_checksum_name}"
  verify_public_file_matches "${desktop_manifest_url}" "${desktop_manifest_path}" "desktop manifest ${desktop_manifest_name}"
  verify_public_file_matches "${desktop_manifest_checksum_url}" "${desktop_manifest_checksum_path}" "desktop manifest checksum ${desktop_manifest_checksum_name}"
  verify_public_file_matches "${combined_checksum_url}" "${combined_checksum_path}" "combined checksum ${combined_checksum_name}"
  verify_public_file_matches "${index_url}" "${index_path}" "web artifact index ${index_name}"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "web_asset_url=${web_asset_url}"
    echo "web_checksum_url=${web_checksum_url}"
    echo "desktop_manifest_url=${desktop_manifest_url}"
    echo "desktop_manifest_checksum_url=${desktop_manifest_checksum_url}"
    echo "checksum_url=${combined_checksum_url}"
    echo "index_url=${index_url}"
    echo "index_path=${index_path}"
    echo "index_asset=${index_name}"
    echo "web_asset_key=${web_asset_key}"
    echo "web_checksum_key=${web_checksum_key}"
    echo "desktop_manifest_key=${desktop_manifest_key}"
    echo "desktop_manifest_checksum_key=${desktop_manifest_checksum_key}"
    echo "checksum_key=${combined_checksum_key}"
    echo "index_key=${index_key}"
  } >>"${GITHUB_OUTPUT}"
fi
