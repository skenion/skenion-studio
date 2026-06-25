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
const targetConfigs = new Map([
  [
    "aarch64-apple-darwin",
    {
      platformSlug: "macos-apple-silicon",
      platformLabel: "macOS Apple silicon",
      artifactFilename: "skenion-runtime-v<version>-macos-apple-silicon",
      executableName: "skenion-runtime"
    }
  ],
  [
    "x86_64-apple-darwin",
    {
      platformSlug: "macos-intel",
      platformLabel: "macOS Intel",
      artifactFilename: "skenion-runtime-v<version>-macos-intel",
      executableName: "skenion-runtime"
    }
  ],
  [
    "x86_64-pc-windows-msvc",
    {
      platformSlug: "windows-x64",
      platformLabel: "Windows x64",
      artifactFilename: "skenion-runtime-v<version>-windows-x64.exe",
      executableName: "skenion-runtime.exe"
    }
  ],
  [
    "aarch64-pc-windows-msvc",
    {
      platformSlug: "windows-arm64",
      platformLabel: "Windows Arm64",
      artifactFilename: "skenion-runtime-v<version>-windows-arm64.exe",
      executableName: "skenion-runtime.exe"
    }
  ],
  [
    "x86_64-unknown-linux-gnu",
    {
      platformSlug: "linux-x64",
      platformLabel: "Linux x64",
      artifactFilename: "skenion-runtime-v<version>-linux-x64",
      executableName: "skenion-runtime"
    }
  ],
  [
    "aarch64-unknown-linux-gnu",
    {
      platformSlug: "linux-arm64",
      platformLabel: "Linux Arm64",
      artifactFilename: "skenion-runtime-v<version>-linux-arm64",
      executableName: "skenion-runtime"
    }
  ]
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
const runtimeArtifactSource = options.runtimeArtifactSource ?? options.runtimeDownloadSource ?? "http";

if (options.version && options.version !== version) {
  fail(`--version (${options.version}) must match Runtime release tag version (${version}).`);
}
const targetConfig = targetConfigs.get(target);
if (!targetConfig) {
  fail(`--target must be one of ${[...targetConfigs.keys()].join(", ")}; got '${target}'.`);
}
if (!releaseModeNames.has(mode) && mode !== "local") {
  fail("--mode must be publish, verify, or local.");
}
if (options.runtimeArtifactSource && options.runtimeDownloadSource) {
  fail("--runtime-artifact-source cannot be combined with --runtime-download-source.");
}
if (!["http", "s3"].includes(runtimeArtifactSource)) {
  fail("--runtime-artifact-source must be http or s3.");
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

const platformSlug = targetConfig.platformSlug;
const assetName = targetConfig.artifactFilename.replace("<version>", version);
const checksumAssetName = `${assetName}.sha256`;
const manifestAssetName = `${assetName}.manifest.json`;
const executableName = targetConfig.executableName;
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
  const expectedSha256 = await stageRuntimeBinary(runtimeArtifact, artifactPath, tempDir);
  if (runtimeArtifact.size !== undefined) {
    await verifyFileSize(artifactPath, runtimeArtifact.size, assetName);
  }
  await verifySha256(artifactPath, expectedSha256, assetName);

  await fs.mkdir(outputDir, { recursive: true });

  const stagedBinary = path.join(outputDir, stagedBinaryName);
  await fs.copyFile(artifactPath, stagedBinary);
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
        manifestSource: manifestPath
      })
    };
  }

  if (manifestUrl) {
    return loadRuntimeManifestUrl(manifestUrl);
  }

  if (releaseModeNames.has(mode)) {
    const releaseEvidence = await loadRuntimeRelease();
    const derivedManifestUrl = runtimeManifestUrlFromReleaseBody(releaseEvidence.release, releaseEvidence.source);
    return loadRuntimeManifestUrl(derivedManifestUrl);
  }

  if (mode !== "local") {
    fail("Runtime manifest evidence is required for release packaging; release-body fallback is only allowed with --mode local.");
  }

  const releaseEvidence = await loadRuntimeRelease();
  return {
    source: releaseEvidence.source,
    ...runtimeArtifactFromReleaseBody(releaseEvidence.release, releaseEvidence.source)
  };
}

async function loadRuntimeManifestUrl(url) {
  const manifest = await fetchJson(url, "Runtime release artifact manifest");
  return {
    source: url,
    ...validateRuntimeManifest(manifest, {
      expectedArtifactName: assetName,
      expectedChecksumName: checksumAssetName,
      expectedManifestName: manifestAssetName,
      manifestSource: url
    })
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
  validateManifestTarget(manifest);
  assertEqual(manifest.platformSlug, platformSlug, "manifest.platformSlug");
  requireNonEmptyString(manifest.tier, "manifest.tier");
  requireNonEmptyString(manifest.sourceCommit, "manifest.sourceCommit");

  assertPlainObject(manifest.contracts, "manifest.contracts");
  requireNonEmptyString(manifest.contracts.version, "manifest.contracts.version");
  requireNonEmptyString(manifest.contracts.line, "manifest.contracts.line");

  const artifact = assertPlainObject(manifest.artifact, "manifest.artifact");
  assertEqual(artifact.binaryFormat, "raw-binary", "manifest.artifact.binaryFormat");
  assertEqual(artifact.executableName, executableName, "manifest.artifact.executableName");
  assertEqual(artifact.filename, expected.expectedArtifactName, "manifest.artifact.filename");
  const sha256 = requireSha256(artifact.sha256, "manifest.artifact.sha256");
  const size = requirePositiveInteger(artifact.size, "manifest.artifact.size");
  const publicUrl = requireHttpUrl(artifact.publicUrl, "manifest.artifact.publicUrl");
  requireRuntimeArtifactUrl(publicUrl, "manifest.artifact.publicUrl", expected.expectedArtifactName);
  requireS3Evidence(artifact.s3, "manifest.artifact.s3", expected.expectedArtifactName);

  const checksum = assertPlainObject(manifest.checksum, "manifest.checksum");
  assertEqual(checksum.filename, expected.expectedChecksumName, "manifest.checksum.filename");
  const checksumUrl = requireHttpUrl(checksum.publicUrl, "manifest.checksum.publicUrl");
  requireRuntimeArtifactUrl(checksumUrl, "manifest.checksum.publicUrl", expected.expectedChecksumName);
  requireS3Evidence(checksum.s3, "manifest.checksum.s3", expected.expectedChecksumName);

  const manifestArtifact = assertPlainObject(manifest.manifest, "manifest.manifest");
  const manifestFilename = requireNonEmptyString(manifestArtifact.filename, "manifest.manifest.filename");
  if (manifestFilename !== expected.expectedManifestName) {
    fail(
      `manifest.manifest.filename is ${manifestFilename}, expected ${expected.expectedManifestName} from ${expected.manifestSource}.`
    );
  }
  requireRuntimeArtifactUrl(
    requireHttpUrl(manifestArtifact.publicUrl, "manifest.manifest.publicUrl"),
    "manifest.manifest.publicUrl",
    expected.expectedManifestName
  );
  requireS3Evidence(manifestArtifact.s3, "manifest.manifest.s3", expected.expectedManifestName);

  return {
    publicUrl,
    checksumUrl,
    sha256,
    size,
    manifestFilename,
    binaryFormat: "raw-binary"
  };
}

function validateManifestTarget(manifest) {
  const targetFields = [];
  if (manifest.target !== undefined) {
    targetFields.push(["manifest.target", manifest.target]);
  }
  if (manifest.rustTargetTriple !== undefined) {
    targetFields.push(["manifest.rustTargetTriple", manifest.rustTargetTriple]);
  }
  if (targetFields.length === 0) {
    fail("manifest.target or manifest.rustTargetTriple must identify the Runtime Rust target.");
  }
  for (const [label, value] of targetFields) {
    assertEqual(value, target, label);
  }
}

function runtimeArtifactFromReleaseBody(release, source) {
  const row = runtimeDownloadsRowFromRelease(release, source);
  const binaryUrl = requireRuntimeArtifactUrl(
    requireHttpUrlFromCell(row.binary, `Runtime downloads table binary URL for ${target}`),
    "Runtime downloads table binary URL",
    assetName
  );
  const checksumUrl = requireRuntimeArtifactUrl(
    requireHttpUrlFromCell(row.sha256, `Runtime downloads table SHA-256 URL for ${target}`),
    "Runtime downloads table SHA-256 URL",
    checksumAssetName
  );

  return {
    publicUrl: binaryUrl,
    checksumUrl,
    manifestFilename: `${source} downloads table`,
    binaryFormat: "raw-binary"
  };
}

function runtimeManifestUrlFromReleaseBody(release, source) {
  const row = runtimeDownloadsRowFromRelease(release, source);
  const binaryUrl = requireRuntimeArtifactUrl(
    requireHttpUrlFromCell(row.binary, `Runtime downloads table binary URL for ${target}`),
    "Runtime downloads table binary URL",
    assetName
  );
  const parsed = new URL(binaryUrl);
  const lastSlash = parsed.pathname.lastIndexOf("/");
  if (lastSlash === -1) {
    fail(`Runtime downloads table binary URL from ${source} does not include a filename path.`);
  }
  parsed.pathname = `${parsed.pathname.slice(0, lastSlash + 1)}${manifestAssetName}`;
  parsed.search = "";
  parsed.hash = "";
  return requireRuntimeArtifactUrl(
    parsed.toString(),
    `Runtime manifest URL derived from ${source}`,
    manifestAssetName
  );
}

function runtimeDownloadsRowFromRelease(release, source) {
  assertPlainObject(release, "Runtime release");
  assertEqual(release.tag_name, releaseTag, "release.tag_name");
  const body = requireNonEmptyString(release.body, "release.body");
  const section = runtimeDownloadsSection(body, source);
  return runtimeDownloadsRow(section, source);
}

async function stageRuntimeBinary(runtimeArtifact, artifactPath, tempDirPath) {
  if (runtimeArtifactSource === "http") {
    const expectedSha256 = runtimeArtifact.sha256 ?? await downloadSha256(runtimeArtifact.checksumUrl, assetName);
    await downloadUrl(runtimeArtifact.publicUrl, artifactPath, assetName);
    return expectedSha256;
  }

  const s3Config = await loadS3DownloadConfig(tempDirPath);
  const checksumPath = path.join(tempDirPath, checksumAssetName);
  const binaryKey = deriveS3Key(runtimeArtifact.publicUrl, assetName, s3Config);
  const checksumKey = deriveS3Key(runtimeArtifact.checksumUrl, checksumAssetName, s3Config);
  await downloadS3Object(s3Config, binaryKey, artifactPath, assetName);
  await downloadS3Object(s3Config, checksumKey, checksumPath, checksumAssetName);
  return parseSha256File(await fs.readFile(checksumPath, "utf8"), assetName, `s3://${s3Config.bucket}/${checksumKey}`);
}

async function loadS3DownloadConfig(tempDirPath) {
  const endpoint = requireEnv("SKENION_RELEASE_S3_ENDPOINT");
  const region = requireEnv("SKENION_RELEASE_S3_REGION");
  const bucket = requireEnv("SKENION_RELEASE_S3_BUCKET");
  const prefix = normalizeS3Prefix(requireEnv("SKENION_RELEASE_S3_PREFIX"));
  const accessKeyId = requireEnv("SKENION_RELEASE_S3_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("SKENION_RELEASE_S3_SECRET_ACCESS_KEY");
  const forcePathStyle = parseBooleanEnv(
    requireEnv("SKENION_RELEASE_S3_FORCE_PATH_STYLE"),
    "SKENION_RELEASE_S3_FORCE_PATH_STYLE"
  );
  const publicBaseUrl = requireEnv("SKENION_RELEASE_PUBLIC_BASE_URL");
  const awsConfigFile = forcePathStyle ? await writeAwsPathStyleConfig(tempDirPath) : undefined;

  return {
    endpoint,
    region,
    bucket,
    prefix,
    accessKeyId,
    secretAccessKey,
    forcePathStyle,
    publicBaseUrl,
    awsConfigFile
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${name} is required when --runtime-artifact-source s3 is used.`);
  }
  return value.trim();
}

function normalizeS3Prefix(value) {
  const prefix = value.replace(/^\/+|\/+$/g, "");
  if (prefix.length === 0) {
    fail("SKENION_RELEASE_S3_PREFIX must not be empty when --runtime-artifact-source s3 is used.");
  }
  return prefix;
}

function parseBooleanEnv(value, name) {
  const normalized = value.toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no"].includes(normalized)) {
    return false;
  }
  fail(`${name} must be true or false.`);
}

async function writeAwsPathStyleConfig(tempDirPath) {
  const configPath = path.join(tempDirPath, "aws-config");
  await fs.writeFile(configPath, "[default]\ns3 =\n    addressing_style = path\n", "utf8");
  return configPath;
}

function deriveS3Key(publicUrl, filename, s3Config) {
  const relativePath = `${runtimeComponent}/${releaseTag}/${platformSlug}/${filename}`;
  const key = `${s3Config.prefix}/${relativePath}`;
  const parsed = new URL(publicUrl);
  const decodedPath = decodeURIComponent(parsed.pathname);
  const validPathSuffixes = [`/${relativePath}`, `/${key}`, `/${s3Config.bucket}/${key}`];
  if (!validPathSuffixes.some((suffix) => decodedPath.endsWith(suffix))) {
    fail(`Runtime artifact URL path ${decodedPath} does not match expected S3 key ${key}.`);
  }

  validatePublicBaseUrl(publicUrl, relativePath, key, s3Config);

  return key;
}

function validatePublicBaseUrl(publicUrl, relativePath, key, s3Config) {
  let base;
  try {
    base = new URL(s3Config.publicBaseUrl);
  } catch {
    fail("SKENION_RELEASE_PUBLIC_BASE_URL must be an absolute URL when set.");
  }

  const parsed = new URL(publicUrl);
  if (parsed.origin !== base.origin) {
    fail(`Runtime artifact URL origin ${parsed.origin} does not match SKENION_RELEASE_PUBLIC_BASE_URL origin ${base.origin}.`);
  }

  const basePath = decodeURIComponent(base.pathname).replace(/\/+$/g, "");
  const decodedPath = decodeURIComponent(parsed.pathname);
  if (basePath && decodedPath !== basePath && !decodedPath.startsWith(`${basePath}/`)) {
    fail(`Runtime artifact URL path ${decodedPath} is outside SKENION_RELEASE_PUBLIC_BASE_URL path ${basePath}.`);
  }

  const pathAfterBase = decodedPath.slice(basePath.length).replace(/^\/+/, "");
  const expectedPaths = new Set([
    relativePath,
    key,
    `${s3Config.bucket}/${key}`
  ]);
  if (!expectedPaths.has(pathAfterBase)) {
    fail(
      `Runtime artifact URL path after SKENION_RELEASE_PUBLIC_BASE_URL is ${pathAfterBase}, expected ${[...expectedPaths].join(" or ")}.`
    );
  }
}

async function downloadS3Object(s3Config, key, destination, label) {
  await run(
    "aws",
    [
      "s3",
      "cp",
      `s3://${s3Config.bucket}/${key}`,
      destination,
      "--endpoint-url",
      s3Config.endpoint,
      "--region",
      s3Config.region,
      "--no-progress"
    ],
    {
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: s3Config.accessKeyId,
        AWS_SECRET_ACCESS_KEY: s3Config.secretAccessKey,
        AWS_DEFAULT_REGION: s3Config.region,
        AWS_REGION: s3Config.region,
        AWS_EC2_METADATA_DISABLED: "true",
        ...(s3Config.awsConfigFile ? { AWS_CONFIG_FILE: s3Config.awsConfigFile } : {})
      }
    }
  ).catch((error) => {
    fail(`Could not download ${label} from s3://${s3Config.bucket}/${key}: ${error.message}`);
  });
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

  const binaryIndex = optionalMarkdownColumn(headers, "binary") ??
    optionalMarkdownColumn(headers, "download") ??
    optionalMarkdownColumn(headers, "artifact");
  if (binaryIndex === undefined) {
    fail(`Runtime downloads table from ${source} is missing binary, download, or artifact column.`);
  }
  const sha256Index = requireMarkdownColumn(headers, "sha256", source);
  const platformIndex = optionalMarkdownColumn(headers, "platform");
  const slugIndex = optionalMarkdownColumn(headers, "platformslug") ?? optionalMarkdownColumn(headers, "slug");
  const targetIndex = optionalMarkdownColumn(headers, "target");

  if (platformIndex === undefined && slugIndex === undefined && targetIndex === undefined) {
    fail(`Runtime downloads table from ${source} must include a Platform, Platform Slug, Slug, or Target column.`);
  }

  const matches = [];
  for (const line of tableLines.slice(2)) {
    const cells = splitMarkdownTableRow(line);
    if (runtimeDownloadsRowMatches(cells, { platformIndex, slugIndex, targetIndex })) {
      matches.push(cells);
    }
  }

  if (matches.length === 0) {
    fail(`Runtime downloads table from ${source} is missing platform row for ${platformSlug} (${target}).`);
  }
  if (matches.length > 1) {
    fail(`Runtime downloads table from ${source} has ambiguous rows for ${platformSlug} (${target}).`);
  }

  const cells = matches[0];
  return {
    binary: cells[binaryIndex] ?? "",
    sha256: cells[sha256Index] ?? ""
  };
}

function runtimeDownloadsRowMatches(cells, indexes) {
  const platform = indexes.platformIndex === undefined ? "" : cleanMarkdownCell(cells[indexes.platformIndex]);
  const slug = indexes.slugIndex === undefined ? "" : cleanMarkdownCell(cells[indexes.slugIndex]);
  const rowTarget = indexes.targetIndex === undefined ? "" : cleanMarkdownCell(cells[indexes.targetIndex]);
  return (
    normalizedSlug(slug) === platformSlug ||
    normalizedPlatformName(platform) === normalizedPlatformName(targetConfig.platformLabel) ||
    normalizedSlug(platform) === platformSlug ||
    rowTarget === target
  );
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

function normalizedSlug(value) {
  return cleanMarkdownCell(value)
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedPlatformName(value) {
  return cleanMarkdownCell(value)
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requireMarkdownColumn(headers, normalizedName, source) {
  const index = headers.indexOf(normalizedName);
  if (index === -1) {
    fail(`Runtime downloads table from ${source} is missing ${normalizedName} column.`);
  }
  return index;
}

function optionalMarkdownColumn(headers, normalizedName) {
  const index = headers.indexOf(normalizedName);
  return index === -1 ? undefined : index;
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
  const expectedPathSuffix = `/${runtimeComponent}/${releaseTag}/${platformSlug}/${expectedFilename}`;
  if (!decodedPath.endsWith(expectedPathSuffix)) {
    fail(`${label} path must end with ${expectedPathSuffix}; got ${decodedPath}.`);
  }
  return url;
}

function requireS3Evidence(value, label, expectedFilename) {
  requireEvidence(value, label);
  const expectedKeySuffix = `${runtimeComponent}/${releaseTag}/${platformSlug}/${expectedFilename}`;
  const key = s3EvidenceKey(value, label);
  if (!key.endsWith(expectedKeySuffix)) {
    fail(`${label}.key must end with ${expectedKeySuffix}; got ${key}.`);
  }
}

function s3EvidenceKey(value, label) {
  if (typeof value === "string") {
    if (value.startsWith("s3://")) {
      const parsed = new URL(value);
      return decodeURIComponent(parsed.pathname).replace(/^\/+/, "");
    }
    return value.replace(/^\/+/, "");
  }
  const key = requireNonEmptyString(value.key, `${label}.key`);
  if (value.bucket !== undefined) {
    requireNonEmptyString(value.bucket, `${label}.bucket`);
  }
  return key.replace(/^\/+/, "");
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
