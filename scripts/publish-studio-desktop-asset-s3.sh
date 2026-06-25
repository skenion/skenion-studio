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

if [[ $# -ne 6 ]]; then
  echo "usage: $0 [--dry-run] <version> <release-tag> <target> <tier> <desktop-asset-path> <desktop-checksum-path>" >&2
  exit 2
fi

version="$1"
release_tag="$2"
target="$3"
tier="$4"
asset_path="$5"
checksum_path="$6"

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

  if [[ "${GITHUB_EVENT_NAME:-}" != "workflow_dispatch" ]]; then
    echo "Studio desktop artifact publishing is only allowed for workflow_dispatch events." >&2
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
  local actual_sha
  local declared_sha
  local declared_name
  local asset_name

  actual_sha="$(sha256_file "${asset_path}")"
  declared_sha="$(awk '{print $1; exit}' "${checksum_path}")"
  declared_name="$(awk '{print $2; exit}' "${checksum_path}")"
  asset_name="$(basename "${asset_path}")"

  if [[ "${actual_sha}" != "${declared_sha}" ]]; then
    echo "checksum file does not match Studio desktop package: ${checksum_path}" >&2
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

if [[ "${dry_run}" != "true" ]]; then
  require_github_actions_publish_context
fi

validate_inputs
require_file "${asset_path}"
require_file "${checksum_path}"
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

asset_name="$(basename "${asset_path}")"
checksum_name="$(basename "${checksum_path}")"
index_name="skenion-studio-desktop-${target}-v${version}.index.json"
index_path="$(dirname "${asset_path}")/${index_name}"
source_commit="${SOURCE_COMMIT:-${GITHUB_SHA:-unknown}}"
contracts_version="${CONTRACTS_VERSION:-}"
contracts_line="${CONTRACTS_LINE:-}"
contracts_range="${CONTRACTS_RANGE:-}"
runtime_tag="${RUNTIME_TAG}"
desktop_signing_mode="${DESKTOP_SIGNING_MODE}"

asset_sha="$(verify_checksum_file)"
asset_size="$(file_size "${asset_path}")"
checksum_sha="$(sha256_file "${checksum_path}")"
checksum_size="$(file_size "${checksum_path}")"

prefix="$(trim_slashes "${SKENION_RELEASE_S3_PREFIX}")"
artifact_dir="$(join_key "${prefix}" "skenion-studio/${release_tag}/desktop/${target}")"
asset_key="$(join_key "${artifact_dir}" "${asset_name}")"
checksum_key="$(join_key "${artifact_dir}" "${checksum_name}")"
index_key="$(join_key "${artifact_dir}" "${index_name}")"
asset_url="$(public_url "$(relative_public_key "${prefix}" "${asset_key}")")"
checksum_url="$(public_url "$(relative_public_key "${prefix}" "${checksum_key}")")"
index_url="$(public_url "$(relative_public_key "${prefix}" "${index_key}")")"

export STUDIO_DESKTOP_SCHEMA="skenion.studio.desktopPackage.v1"
export STUDIO_DESKTOP_COMPONENT="skenion-studio"
export STUDIO_DESKTOP_VERSION="${version}"
export STUDIO_DESKTOP_TAG="${release_tag}"
export STUDIO_DESKTOP_SOURCE_COMMIT="${source_commit}"
export STUDIO_DESKTOP_TARGET="${target}"
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

write_index() {
  local output_path="$1"

  "${python_bin}" - "${output_path}" <<'PY'
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
    "target": os.environ["STUDIO_DESKTOP_TARGET"],
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
    "desktopPackage": {
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
}

write_index "${index_path}"
index_sha="$(sha256_file "${index_path}")"
index_size="$(file_size "${index_path}")"

if [[ "${dry_run}" == "true" ]]; then
  echo "dry run: would publish Studio desktop package to ${asset_url}"
  echo "dry run: would publish Studio desktop checksum to ${checksum_url}"
  echo "dry run: would publish Studio desktop index to ${index_url}"
else
  if ! command -v aws >/dev/null 2>&1; then
    echo "aws CLI is required for Studio desktop artifact publishing." >&2
    exit 1
  fi
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for Studio desktop artifact public-read verification." >&2
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

if field in {"sha256", "component", "artifact-set", "studio-version", "source-tag", "source-commit", "target"}:
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
    local actual_target

    actual_sha="$(read_s3_head_field sha256 "${head_json}")"
    actual_size="$(read_s3_head_field size "${head_json}")"
    actual_component="$(read_s3_head_field component "${head_json}")"
    actual_artifact_set="$(read_s3_head_field artifact-set "${head_json}")"
    actual_version="$(read_s3_head_field studio-version "${head_json}")"
    actual_tag="$(read_s3_head_field source-tag "${head_json}")"
    actual_commit="$(read_s3_head_field source-commit "${head_json}")"
    actual_target="$(read_s3_head_field target "${head_json}")"

    if [[ "${actual_sha}" == "${expected_sha}" \
      && "${actual_size}" == "${expected_size}" \
      && "${actual_component}" == "skenion-studio" \
      && "${actual_artifact_set}" == "desktop" \
      && "${actual_version}" == "${version}" \
      && "${actual_tag}" == "${release_tag}" \
      && "${actual_commit}" == "${source_commit}" \
      && "${actual_target}" == "${target}" ]]; then
      return 0
    fi

    echo "Studio desktop release ${label} S3 metadata does not match expected immutable artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
    echo "expected sha256=${expected_sha} size=${expected_size} component=skenion-studio artifact-set=desktop studio-version=${version} source-tag=${release_tag} source-commit=${source_commit} target=${target}" >&2
    echo "actual sha256=${actual_sha:-<missing>} size=${actual_size:-<missing>} component=${actual_component:-<missing>} artifact-set=${actual_artifact_set:-<missing>} studio-version=${actual_version:-<missing>} source-tag=${actual_tag:-<missing>} source-commit=${actual_commit:-<missing>} target=${actual_target:-<missing>}" >&2
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
    local actual_target

    actual_sha="$(read_s3_head_field sha256 "${head_json}")"
    actual_size="$(read_s3_head_field size "${head_json}")"
    actual_component="$(read_s3_head_field component "${head_json}")"
    actual_artifact_set="$(read_s3_head_field artifact-set "${head_json}")"
    actual_version="$(read_s3_head_field studio-version "${head_json}")"
    actual_tag="$(read_s3_head_field source-tag "${head_json}")"
    actual_commit="$(read_s3_head_field source-commit "${head_json}")"
    actual_target="$(read_s3_head_field target "${head_json}")"

    if [[ "${actual_size}" != "${expected_size}" ]]; then
      echo "Studio desktop release existing S3 object size does not match expected artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
      echo "expected size=${expected_size}" >&2
      echo "actual size=${actual_size:-<missing>}" >&2
      return 1
    fi

    if [[ -z "${actual_sha}${actual_component}${actual_artifact_set}${actual_version}${actual_tag}${actual_commit}${actual_target}" ]]; then
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
      echo "refusing to overwrite existing Studio desktop release artifact: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
      exit 1
    fi

    if grep -Eiq '(404|Not Found|NoSuchKey|NotFound)' "${head_err}"; then
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
    local content_type="$5"

    if object_exists_with_same_metadata "${key}" "${sha}" "${size}"; then
      return 0
    fi

    if ! aws --endpoint-url "${SKENION_RELEASE_S3_ENDPOINT}" s3api put-object \
      --bucket "${SKENION_RELEASE_S3_BUCKET}" \
      --key "${key}" \
      --body "${path}" \
      --content-type "${content_type}" \
      --metadata "sha256=${sha},component=skenion-studio,artifact-set=desktop,studio-version=${version},source-tag=${release_tag},source-commit=${source_commit},target=${target}" \
      --if-none-match '*' >/dev/null 2>"${head_err}"; then
      echo "failed to conditionally upload Studio desktop release artifact without overwriting: s3://${SKENION_RELEASE_S3_BUCKET}/${key}" >&2
      cat "${head_err}" >&2
      exit 1
    fi

    echo "uploaded Studio desktop release object: s3://${SKENION_RELEASE_S3_BUCKET}/${key}"
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
        echo "public Studio desktop release ${label} is not ready on attempt ${attempt}/${public_verify_attempts}: ${public_verify_failure}; retrying in ${public_verify_sleep_seconds}s: ${url}" >&2
        maybe_sleep_before_public_retry
      fi
    done

    if [[ "${public_verify_failure}" == "HEAD request failed" ]]; then
      echo "failed to verify public Studio desktop release ${label}: ${url}" >&2
    elif [[ "${public_verify_failure}" == "missing Content-Length" ]]; then
      echo "public Studio desktop release ${label} is missing Content-Length: ${url}" >&2
    else
      echo "public Studio desktop release ${label} Content-Length does not match local file: ${url}" >&2
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
        echo "public Studio desktop release ${label} is not ready on attempt ${attempt}/${public_verify_attempts}: ${public_verify_failure}; retrying in ${public_verify_sleep_seconds}s: ${url}" >&2
        maybe_sleep_before_public_retry
      fi
    done

    if [[ "${public_verify_failure}" == "GET request failed" ]]; then
      echo "failed to download public Studio desktop release ${label}: ${url}" >&2
    else
      echo "public Studio desktop release ${label} content does not match local file: ${url}" >&2
      echo "expected sha256=${public_verify_expected_sha:-<missing>}" >&2
      echo "actual sha256=${public_verify_actual_sha:-<missing>}" >&2
    fi
    exit 1
  }

  asset_content_type="application/gzip"
  if [[ "${asset_name}" == *.zip ]]; then
    asset_content_type="application/zip"
  fi

  upload_object "${asset_path}" "${asset_key}" "${asset_sha}" "${asset_size}" "${asset_content_type}"
  upload_object "${checksum_path}" "${checksum_key}" "${checksum_sha}" "${checksum_size}" "text/plain"
  upload_object "${index_path}" "${index_key}" "${index_sha}" "${index_size}" "application/json"

  verify_public_content_length "${asset_url}" "${asset_size}" "desktop package ${asset_name}"
  verify_public_content_length "${checksum_url}" "${checksum_size}" "desktop checksum ${checksum_name}"
  verify_public_content_length "${index_url}" "${index_size}" "desktop index ${index_name}"
  verify_public_file_matches "${asset_url}" "${asset_path}" "desktop package ${asset_name}"
  verify_public_file_matches "${checksum_url}" "${checksum_path}" "desktop checksum ${checksum_name}"
  verify_public_file_matches "${index_url}" "${index_path}" "desktop index ${index_name}"
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "desktop_asset_url=${asset_url}"
    echo "desktop_checksum_url=${checksum_url}"
    echo "index_url=${index_url}"
    echo "index_path=${index_path}"
    echo "index_asset=${index_name}"
    echo "desktop_asset_key=${asset_key}"
    echo "desktop_checksum_key=${checksum_key}"
    echo "index_key=${index_key}"
  } >>"${GITHUB_OUTPUT}"
fi
