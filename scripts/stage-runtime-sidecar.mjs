#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultOutputDir = path.join(rootDir, "src-tauri", "binaries");
const runtimeManifestSchema = "skenion.runtime.releaseArtifact.v1";
const runtimeComponent = "skenion-runtime";
const releaseModeNames = new Set(["publish", "verify"]);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const supportedTargets = new Set([
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu"
]);

const options = parseArgs(process.argv.slice(2));
const releaseTag = requireOption(options.runtimeTag ?? options.tag, "--runtime-tag");
const version = runtimeVersionFromTag(releaseTag);
const target = requireOption(options.target, "--target");
const mode = options.mode ?? "verify";
const runtimeRepo = options.repo ?? "skenion/skenion-runtime";
const outputDir = path.resolve(rootDir, options.outputDir ?? defaultOutputDir);
const manifestUrl = options.runtimeManifestUrl ?? options.manifestUrl;

if (options.version && options.version !== version) {
  fail(`--version (${options.version}) must match Runtime release tag version (${version}).`);
}
if (!supportedTargets.has(target)) {
  fail(`--target must be one of ${[...supportedTargets].join(", ")}; got '${target}'.`);
}
if (!releaseModeNames.has(mode) && mode !== "local") {
  fail("--mode must be publish, verify, or local.");
}
if (options.manifest && manifestUrl) {
  fail("--manifest cannot be combined with --manifest-url or --runtime-manifest-url.");
}
if (options.checkManifestOnly && !options.manifest) {
  fail("--manifest is required with --check-manifest-only.");
}

const assetName = `skenion-runtime-v${version}-${target}.tar.gz`;
const checksumAssetName = `${assetName}.sha256`;
const manifestAssetName = `${assetName}.manifest.json`;
const binaryName = target.includes("windows") ? "skenion-runtime.exe" : "skenion-runtime";
const stagedBinaryName = `skenion-runtime-${target}${target.includes("windows") ? ".exe" : ""}`;

const manifestEvidence = await loadRuntimeManifest();
const runtimeArtifact = validateRuntimeManifest(manifestEvidence.manifest, {
  expectedArtifactName: assetName,
  expectedChecksumName: checksumAssetName,
  expectedManifestName: manifestAssetName,
  enforceManifestFilename: !manifestUrl,
  manifestSource: manifestEvidence.source
});

if (options.checkManifestOnly) {
  console.log(
    `validated Runtime release manifest ${runtimeArtifact.manifestFilename} for ${assetName} with sha256 ${runtimeArtifact.sha256}`
  );
  process.exit(0);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-runtime-artifact-"));

try {
  const artifactPath = path.join(tempDir, assetName);
  await downloadUrl(runtimeArtifact.publicUrl, artifactPath, assetName);
  await verifyFileSize(artifactPath, runtimeArtifact.size, assetName);
  await verifySha256(artifactPath, runtimeArtifact.sha256, assetName);

  await run("tar", ["-xzf", path.basename(artifactPath)], { cwd: tempDir });
  const extractedBinary = path.join(
    tempDir,
    `skenion-runtime-v${version}-${target}`,
    binaryName
  );
  await fs.access(extractedBinary);
  await fs.mkdir(outputDir, { recursive: true });

  const stagedBinary = path.join(outputDir, stagedBinaryName);
  await fs.copyFile(extractedBinary, stagedBinary);
  if (!target.includes("windows")) {
    await fs.chmod(stagedBinary, 0o755);
  }

  console.log(`staged Runtime binary ${path.relative(rootDir, stagedBinary)}`);
  console.log(`verified ${assetName} from ${runtimeArtifact.publicUrl} with sha256 ${runtimeArtifact.sha256}`);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check-manifest-only") {
      parsed.checkManifestOnly = true;
      const maybeManifest = args[index + 1];
      if (maybeManifest && !maybeManifest.startsWith("--")) {
        if (parsed.manifest) {
          fail("--check-manifest-only path cannot be combined with --manifest.");
        }
        parsed.manifest = maybeManifest;
        index += 1;
      }
      continue;
    }
    if (arg === "--") {
      continue;
    }
    if (!arg.startsWith("--")) {
      fail(`Unexpected positional argument '${arg}'.`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${arg}.`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function requireOption(value, name) {
  if (!value) {
    fail(`${name} is required.`);
  }
  return value;
}

function runtimeVersionFromTag(tag) {
  const match = tag.match(/^v(.+)$/);
  if (!match || !semverPattern.test(match[1])) {
    fail(`--runtime-tag must use vx.y.z form; got '${tag}'.`);
  }
  return match[1];
}

async function getRelease(repo, tag) {
  const response = await githubFetch(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });
  if (!response.ok) {
    fail(`Could not load Runtime release ${repo}@${tag}: ${response.status} ${response.statusText}.`);
  }
  return response.json();
}

async function loadRuntimeManifest() {
  if (options.manifest) {
    const manifestPath = path.resolve(rootDir, options.manifest);
    return {
      source: manifestPath,
      manifest: JSON.parse(await fs.readFile(manifestPath, "utf8"))
    };
  }

  if (manifestUrl) {
    return {
      source: manifestUrl,
      manifest: await fetchJson(manifestUrl, "Runtime release artifact manifest")
    };
  }

  const release = await getRelease(runtimeRepo, releaseTag);
  const manifest = await downloadReleaseJsonAsset(release, manifestAssetName);
  return {
    source: `${runtimeRepo}@${releaseTag}:${manifestAssetName}`,
    manifest
  };
}

async function downloadReleaseJsonAsset(release, assetNameToDownload) {
  const asset = release.assets?.find((candidate) => candidate.name === assetNameToDownload);
  if (!asset) {
    fail(`Runtime release ${release.tag_name} is missing asset ${assetNameToDownload}.`);
  }

  const response = await githubFetch(asset.url, {
    headers: {
      Accept: "application/octet-stream"
    }
  });
  if (!response.ok) {
    fail(`Could not download ${assetNameToDownload}: ${response.status} ${response.statusText}.`);
  }
  return response.json();
}

function validateRuntimeManifest(manifest, expected) {
  assertPlainObject(manifest, "Runtime manifest");
  assertEqual(manifest.schema, runtimeManifestSchema, "manifest.schema");
  assertEqual(manifest.component, runtimeComponent, "manifest.component");
  assertEqual(manifest.runtimeVersion, version, "manifest.runtimeVersion");
  assertEqual(manifest.releaseTag, releaseTag, "manifest.releaseTag");
  assertEqual(manifest.target, target, "manifest.target");
  requireNonEmptyString(manifest.tier, "manifest.tier");
  requireNonEmptyString(manifest.sourceCommit, "manifest.sourceCommit");

  assertPlainObject(manifest.contracts, "manifest.contracts");
  requireNonEmptyString(manifest.contracts.version, "manifest.contracts.version");
  requireNonEmptyString(manifest.contracts.line, "manifest.contracts.line");

  const artifact = assertPlainObject(manifest.artifact, "manifest.artifact");
  assertEqual(artifact.filename, expected.expectedArtifactName, "manifest.artifact.filename");
  const sha256 = requireSha256(artifact.sha256, "manifest.artifact.sha256");
  const size = requirePositiveInteger(artifact.size, "manifest.artifact.size");
  const publicUrl = requireHttpUrl(artifact.publicUrl, "manifest.artifact.publicUrl");
  requireEvidence(artifact.s3, "manifest.artifact.s3");

  const checksum = assertPlainObject(manifest.checksum, "manifest.checksum");
  assertEqual(checksum.filename, expected.expectedChecksumName, "manifest.checksum.filename");
  requireHttpUrl(checksum.publicUrl, "manifest.checksum.publicUrl");
  requireEvidence(checksum.s3, "manifest.checksum.s3");

  const manifestArtifact = assertPlainObject(manifest.manifest, "manifest.manifest");
  const manifestFilename = requireNonEmptyString(manifestArtifact.filename, "manifest.manifest.filename");
  if (expected.enforceManifestFilename && manifestFilename !== expected.expectedManifestName) {
    fail(
      `manifest.manifest.filename is ${manifestFilename}, expected ${expected.expectedManifestName} from ${expected.manifestSource}.`
    );
  }
  requireHttpUrl(manifestArtifact.publicUrl, "manifest.manifest.publicUrl");
  requireEvidence(manifestArtifact.s3, "manifest.manifest.s3");

  return {
    publicUrl,
    sha256,
    size,
    manifestFilename
  };
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    fail(`${label} must be an object.`);
  }
  return value;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} is ${actual ?? "<missing>"}, expected ${expected}.`);
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !/^[a-fA-F0-9]{64}$/.test(value)) {
    fail(`${label} must be a 64-character SHA-256 hex digest.`);
  }
  return value.toLowerCase();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    fail(`${label} must be a positive integer byte size.`);
  }
  return value;
}

function requireHttpUrl(value, label) {
  const stringValue = requireNonEmptyString(value, label);
  let parsed;
  try {
    parsed = new URL(stringValue);
  } catch {
    fail(`${label} must be an absolute URL.`);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    fail(`${label} must use http or https.`);
  }
  return stringValue;
}

function requireEvidence(value, label) {
  if (value === null || value === undefined) {
    fail(`${label} is required.`);
  }
  if (typeof value === "string" && value.trim().length === 0) {
    fail(`${label} must not be empty.`);
  }
  if (typeof value !== "string" && !isPlainObject(value)) {
    fail(`${label} must be a string or object.`);
  }
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

async function fetchJson(url, label) {
  const response = await authenticatedFetch(url, {
    headers: {
      Accept: "application/json"
    }
  });
  if (!response.ok) {
    fail(`Could not download ${label} from ${url}: ${response.status} ${response.statusText}.`);
  }
  return response.json();
}

async function downloadUrl(url, destination, label) {
  const response = await authenticatedFetch(url, {
    headers: {
      Accept: "application/octet-stream"
    }
  });
  if (!response.ok) {
    fail(`Could not download ${label} from ${url}: ${response.status} ${response.statusText}.`);
  }
  await pipeline(response.body, createWriteStream(destination));
}

async function verifyFileSize(filePath, expectedSize, label) {
  const stats = await fs.stat(filePath);
  if (stats.size !== expectedSize) {
    fail(`size mismatch for ${label}: expected ${expectedSize}, got ${stats.size}.`);
  }
}

async function verifySha256(filePath, expected, label) {
  const hash = createHash("sha256");
  const body = await fs.readFile(filePath);
  hash.update(body);
  const actual = hash.digest("hex");
  if (actual !== expected.toLowerCase()) {
    fail(`SHA-256 mismatch for ${label}: expected ${expected}, got ${actual}.`);
  }
}

async function githubFetch(url, init = {}) {
  const token = process.env.GH_TOKEN;
  if (!token) {
    fail("GH_TOKEN is required to read Runtime GitHub release manifest assets.");
  }
  const headers = {
    "User-Agent": "skenion-studio-runtime-manifest-stager",
    ...init.headers
  };
  headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    ...init,
    headers
  });
}

async function authenticatedFetch(url, init = {}) {
  const headers = {
    "User-Agent": "skenion-studio-runtime-manifest-stager",
    ...init.headers
  };
  if (isGitHubUrl(url)) {
    const token = process.env.GH_TOKEN;
    if (releaseModeNames.has(mode) && !token) {
      fail(`GH_TOKEN is required to read GitHub-hosted Runtime manifest evidence: ${url}`);
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return fetch(url, {
    ...init,
    headers
  });
}

function isGitHubUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "github.com" || hostname === "api.github.com" || hostname.endsWith(".githubusercontent.com");
  } catch {
    return false;
  }
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
