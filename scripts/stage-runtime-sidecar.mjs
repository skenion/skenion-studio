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
const runtimeDownloadsStartMarker = "<!-- skenion-runtime-downloads:start -->";
const runtimeDownloadsEndMarker = "<!-- skenion-runtime-downloads:end -->";
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
const runtimeReleaseJson = options.runtimeReleaseJson ?? options.releaseJson;

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
if (runtimeReleaseJson && (options.manifest || manifestUrl)) {
  fail("--runtime-release-json cannot be combined with manifest inputs.");
}
if (options.checkManifestOnly && !options.manifest) {
  fail("--manifest is required with --check-manifest-only.");
}

const assetName = `skenion-runtime-v${version}-${target}.tar.gz`;
const checksumAssetName = `${assetName}.sha256`;
const manifestAssetName = `${assetName}.manifest.json`;
const binaryName = target.includes("windows") ? "skenion-runtime.exe" : "skenion-runtime";
const stagedBinaryName = `skenion-runtime-${target}${target.includes("windows") ? ".exe" : ""}`;

const runtimeArtifact = await loadRuntimeArtifact();

if (options.checkManifestOnly) {
  console.log(
    `validated Runtime release manifest ${runtimeArtifact.manifestFilename} for ${assetName} with sha256 ${runtimeArtifact.sha256}`
  );
  process.exit(0);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-runtime-artifact-"));

try {
  const artifactPath = path.join(tempDir, assetName);
  const expectedSha256 = runtimeArtifact.sha256 ?? await downloadSha256(runtimeArtifact.checksumUrl, assetName);
  await downloadUrl(runtimeArtifact.publicUrl, artifactPath, assetName);
  if (runtimeArtifact.size !== undefined) {
    await verifyFileSize(artifactPath, runtimeArtifact.size, assetName);
  }
  await verifySha256(artifactPath, expectedSha256, assetName);

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
  console.log(`verified ${assetName} from ${runtimeArtifact.publicUrl} with sha256 ${expectedSha256}`);
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

async function loadRuntimeArtifact() {
  if (options.manifest) {
    const manifestPath = path.resolve(rootDir, options.manifest);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    return {
      source: manifestPath,
      ...validateRuntimeManifest(manifest, {
        expectedArtifactName: assetName,
        expectedChecksumName: checksumAssetName,
        expectedManifestName: manifestAssetName,
        enforceManifestFilename: true,
        manifestSource: manifestPath
      })
    };
  }

  if (manifestUrl) {
    const manifest = await fetchJson(manifestUrl, "Runtime release artifact manifest");
    return {
      source: manifestUrl,
      ...validateRuntimeManifest(manifest, {
        expectedArtifactName: assetName,
        expectedChecksumName: checksumAssetName,
        expectedManifestName: manifestAssetName,
        enforceManifestFilename: false,
        manifestSource: manifestUrl
      })
    };
  }

  const releaseEvidence = await loadRuntimeRelease();
  return {
    source: releaseEvidence.source,
    ...runtimeArtifactFromReleaseBody(releaseEvidence.release, releaseEvidence.source)
  };
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

async function loadRuntimeRelease() {
  if (runtimeReleaseJson) {
    const releasePath = path.resolve(rootDir, runtimeReleaseJson);
    return {
      source: releasePath,
      release: JSON.parse(await fs.readFile(releasePath, "utf8"))
    };
  }

  return {
    source: `${runtimeRepo}@${releaseTag}:release body`,
    release: await getRelease(runtimeRepo, releaseTag)
  };
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

function runtimeArtifactFromReleaseBody(release, source) {
  assertPlainObject(release, "Runtime release");
  assertEqual(release.tag_name, releaseTag, "release.tag_name");
  const body = requireNonEmptyString(release.body, "release.body");
  const section = runtimeDownloadsSection(body, source);
  const row = runtimeDownloadsRow(section, source);
  const archiveUrl = requireRuntimeArtifactUrl(
    requireHttpUrlFromCell(row.archive, `Runtime downloads table archive URL for ${target}`),
    "Runtime downloads table archive URL",
    assetName
  );
  const checksumUrl = requireRuntimeArtifactUrl(
    requireHttpUrlFromCell(row.sha256, `Runtime downloads table SHA-256 URL for ${target}`),
    "Runtime downloads table SHA-256 URL",
    checksumAssetName
  );

  return {
    publicUrl: archiveUrl,
    checksumUrl,
    manifestFilename: `${source} downloads table`
  };
}

function runtimeDownloadsSection(body, source) {
  const start = body.indexOf(runtimeDownloadsStartMarker);
  if (start === -1) {
    fail(`Runtime release body from ${source} is missing ${runtimeDownloadsStartMarker}.`);
  }
  const contentStart = start + runtimeDownloadsStartMarker.length;
  const end = body.indexOf(runtimeDownloadsEndMarker, contentStart);
  if (end === -1) {
    fail(`Runtime release body from ${source} is missing ${runtimeDownloadsEndMarker}.`);
  }
  return body.slice(contentStart, end);
}

function runtimeDownloadsRow(section, source) {
  const tableLines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (tableLines.length < 3) {
    fail(`Runtime downloads table from ${source} is missing or incomplete.`);
  }

  const headers = splitMarkdownTableRow(tableLines[0]).map(normalizeMarkdownHeader);
  const separator = splitMarkdownTableRow(tableLines[1]);
  if (!separator.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))) {
    fail(`Runtime downloads table from ${source} is missing a markdown separator row.`);
  }

  const targetIndex = requireMarkdownColumn(headers, "target", source);
  const archiveIndex = requireMarkdownColumn(headers, "archive", source);
  const sha256Index = requireMarkdownColumn(headers, "sha256", source);

  for (const line of tableLines.slice(2)) {
    const cells = splitMarkdownTableRow(line);
    if (cleanMarkdownCell(cells[targetIndex]) !== target) {
      continue;
    }
    return {
      archive: cells[archiveIndex] ?? "",
      sha256: cells[sha256Index] ?? ""
    };
  }

  fail(`Runtime downloads table from ${source} is missing target row for ${target}.`);
}

function splitMarkdownTableRow(line) {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function normalizeMarkdownHeader(value) {
  return cleanMarkdownCell(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanMarkdownCell(value = "") {
  return value.replace(/`/g, "").trim();
}

function requireMarkdownColumn(headers, normalizedName, source) {
  const index = headers.indexOf(normalizedName);
  if (index === -1) {
    fail(`Runtime downloads table from ${source} is missing ${normalizedName} column.`);
  }
  return index;
}

function requireHttpUrlFromCell(cell, label) {
  const linkMatch = cell.match(/\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  const rawMatch = cell.match(/https?:\/\/[^\s|)]+/i);
  const url = linkMatch?.[1] ?? rawMatch?.[0];
  if (!url) {
    fail(`${label} is missing an http(s) URL.`);
  }
  return requireHttpUrl(url, label);
}

function requireRuntimeArtifactUrl(url, label, expectedFilename) {
  const parsed = new URL(url);
  const decodedPath = decodeURIComponent(parsed.pathname);
  const expectedPathSuffix = `/${runtimeComponent}/v${version}/${target}/${expectedFilename}`;
  if (!decodedPath.endsWith(expectedPathSuffix)) {
    fail(`${label} path must end with ${expectedPathSuffix}; got ${decodedPath}.`);
  }
  return url;
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

async function downloadSha256(url, expectedFilename) {
  const response = await authenticatedFetch(url, {
    headers: {
      Accept: "text/plain, application/octet-stream"
    }
  });
  if (!response.ok) {
    fail(`Could not download ${expectedFilename} SHA-256 from ${url}: ${response.status} ${response.statusText}.`);
  }
  return parseSha256File(await response.text(), expectedFilename, url);
}

function parseSha256File(text, expectedFilename, source) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 1) {
    fail(`SHA-256 file from ${source} must contain exactly one non-empty line.`);
  }

  const match = lines[0].match(/^([a-fA-F0-9]{64})(?:[ \t]+[*]?(.+))?$/);
  if (!match) {
    fail(`SHA-256 file from ${source} must start with a 64-character SHA-256 digest.`);
  }

  const filename = match[2]?.trim();
  if (filename && path.basename(filename) !== expectedFilename) {
    fail(`SHA-256 file from ${source} names ${filename}, expected ${expectedFilename}.`);
  }

  return match[1].toLowerCase();
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
    fail("GH_TOKEN is required to read Runtime GitHub release metadata.");
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
