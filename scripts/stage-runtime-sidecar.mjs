#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultOutputDir = path.join(rootDir, "src-tauri", "binaries");
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
const version = requireOption(options.version, "--version");
const target = requireOption(options.target, "--target");
const mode = options.mode ?? "verify";
const runtimeRepo = options.repo ?? "skenion/skenion-runtime";
const releaseTag = options.tag ?? `skenion-runtime-v${version}`;
const outputDir = path.resolve(rootDir, options.outputDir ?? defaultOutputDir);

if (!semverPattern.test(version)) {
  fail(`--version must use x.y.z SemVer form; got '${version}'.`);
}
if (!supportedTargets.has(target)) {
  fail(`--target must be one of ${[...supportedTargets].join(", ")}; got '${target}'.`);
}
if (!releaseModeNames.has(mode) && mode !== "local") {
  fail("--mode must be publish, verify, or local.");
}
if (releaseTag !== `skenion-runtime-v${version}`) {
  fail(`Runtime release tag ${releaseTag} must match same-train version ${version}.`);
}

const assetName = `skenion-runtime-v${version}-${target}.tar.gz`;
const checksumAssetName = `${assetName}.sha256`;
const binaryName = target.includes("windows") ? "skenion-runtime.exe" : "skenion-runtime";
const stagedBinaryName = `skenion-runtime-${target}${target.includes("windows") ? ".exe" : ""}`;

if (options.checkManifestOnly) {
  const expectedChecksum = await checksumFromTrainManifest(options.checkManifestOnly, target, assetName);
  if (!expectedChecksum) {
    fail(`Missing SHA-256 checksum for ${assetName} in ${options.checkManifestOnly}.`);
  }
  console.log(`manifest selects ${assetName} with sha256 ${expectedChecksum}`);
  process.exit(0);
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-runtime-sidecar-"));

try {
  const release = await getRelease(runtimeRepo, releaseTag);
  const artifactPath = path.join(tempDir, assetName);
  const checksumPath = path.join(tempDir, checksumAssetName);

  await downloadReleaseAsset(release, assetName, artifactPath);
  const expectedChecksum = options.manifest
    ? await checksumFromTrainManifest(options.manifest, target, assetName)
    : await checksumFromReleaseAsset(release, checksumAssetName, checksumPath, assetName);

  if (!expectedChecksum) {
    const source = options.manifest ? options.manifest : checksumAssetName;
    const message = `Missing SHA-256 checksum for ${assetName} in ${source}.`;
    if (releaseModeNames.has(mode)) {
      fail(message);
    }
    console.warn(`warning: ${message}`);
  } else {
    await verifySha256(artifactPath, expectedChecksum, assetName);
  }

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

  console.log(`staged Runtime sidecar ${path.relative(rootDir, stagedBinary)}`);
  console.log(`verified ${assetName} with sha256 ${expectedChecksum}`);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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

async function downloadReleaseAsset(release, assetNameToDownload, destination) {
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
  await pipeline(response.body, createWriteStream(destination));
}

async function checksumFromReleaseAsset(release, checksumName, destination, expectedAssetName) {
  await downloadReleaseAsset(release, checksumName, destination);
  const body = await fs.readFile(destination, "utf8");
  const firstLine = body.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) {
    return null;
  }

  const match = firstLine.trim().match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/);
  if (!match) {
    fail(`${checksumName} is not a sha256sum-compatible checksum manifest.`);
  }
  const checksumAssetName = path.basename(match[2].trim());
  if (checksumAssetName !== expectedAssetName) {
    fail(`${checksumName} describes ${checksumAssetName}, expected ${expectedAssetName}.`);
  }
  return match[1].toLowerCase();
}

async function checksumFromTrainManifest(manifestPath, targetName, expectedAssetName) {
  const manifest = JSON.parse(await fs.readFile(path.resolve(rootDir, manifestPath), "utf8"));
  const candidate = manifest?.components?.runtime?.binaries?.[targetName];
  if (!candidate) {
    return null;
  }

  const artifactName = candidate.name ?? candidate.assetName ?? path.basename(candidate.url ?? "");
  if (artifactName && artifactName !== expectedAssetName) {
    fail(`Manifest runtime binary for ${targetName} points at ${artifactName}, expected ${expectedAssetName}.`);
  }

  const checksum = candidate.sha256 ?? candidate.checksum?.sha256 ?? candidate.checksum?.value;
  if (typeof checksum !== "string" || !/^[a-fA-F0-9]{64}$/.test(checksum)) {
    return null;
  }
  return checksum.toLowerCase();
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
  const token =
    process.env.SKENION_RELEASE_TRAIN_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const headers = {
    "User-Agent": "skenion-studio-sidecar-stager",
    ...init.headers
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(url, {
    ...init,
    headers
  });
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
