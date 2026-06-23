#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deflateRaw } from "node:zlib";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultOutputDir = path.join(rootDir, "artifacts", "studio-desktop");
const deflateRawAsync = promisify(deflateRaw);
const crc32Table = createCrc32Table();
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const targetConfigs = new Map([
  [
    "aarch64-apple-darwin",
    {
      archiveExtension: "tar.gz",
      requiredFamilies: ["dmg"],
      isArtifact(relativePath) {
        const lower = relativePath.toLowerCase();
        return lower.endsWith(".dmg") || lower.endsWith(".app.tar.gz") || lower.endsWith(".app.tar.gz.sig");
      },
      familyFor(relativePath) {
        return relativePath.toLowerCase().endsWith(".dmg") ? "dmg" : "macos-app-archive";
      }
    }
  ],
  [
    "x86_64-apple-darwin",
    {
      archiveExtension: "tar.gz",
      requiredFamilies: ["dmg"],
      isArtifact(relativePath) {
        const lower = relativePath.toLowerCase();
        return lower.endsWith(".dmg") || lower.endsWith(".app.tar.gz") || lower.endsWith(".app.tar.gz.sig");
      },
      familyFor(relativePath) {
        return relativePath.toLowerCase().endsWith(".dmg") ? "dmg" : "macos-app-archive";
      }
    }
  ],
  [
    "x86_64-pc-windows-msvc",
    {
      archiveExtension: "zip",
      requiredFamilies: ["nsis-setup"],
      isArtifact(relativePath) {
        const normalized = normalizeArchivePath(relativePath).toLowerCase();
        return (
          normalized.endsWith(".msi") ||
          normalized.endsWith("-setup.exe") ||
          (normalized.includes("/nsis/") && normalized.endsWith(".exe"))
        );
      },
      familyFor(relativePath) {
        return relativePath.toLowerCase().endsWith(".msi") ? "msi" : "nsis-setup";
      }
    }
  ],
  [
    "aarch64-pc-windows-msvc",
    {
      archiveExtension: "zip",
      requiredFamilies: ["nsis-setup"],
      isArtifact(relativePath) {
        const normalized = normalizeArchivePath(relativePath).toLowerCase();
        return (
          normalized.endsWith(".msi") ||
          normalized.endsWith("-setup.exe") ||
          (normalized.includes("/nsis/") && normalized.endsWith(".exe"))
        );
      },
      familyFor(relativePath) {
        return relativePath.toLowerCase().endsWith(".msi") ? "msi" : "nsis-setup";
      }
    }
  ],
  [
    "x86_64-unknown-linux-gnu",
    {
      archiveExtension: "tar.gz",
      requiredFamilies: ["deb", "rpm"],
      isArtifact(relativePath) {
        const lower = relativePath.toLowerCase();
        return lower.endsWith(".deb") || lower.endsWith(".rpm");
      },
      familyFor(relativePath) {
        return relativePath.toLowerCase().endsWith(".deb") ? "deb" : "rpm";
      }
    }
  ],
  [
    "aarch64-unknown-linux-gnu",
    {
      archiveExtension: "tar.gz",
      requiredFamilies: ["deb", "rpm"],
      isArtifact(relativePath) {
        const lower = relativePath.toLowerCase();
        return lower.endsWith(".deb") || lower.endsWith(".rpm");
      },
      familyFor(relativePath) {
        return relativePath.toLowerCase().endsWith(".deb") ? "deb" : "rpm";
      }
    }
  ]
]);

const options = parseArgs(process.argv.slice(2));
const target = requireOption(options.target, "--target");
const config = targetConfigs.get(target);

if (!config) {
  fail(`--target must be one of ${[...targetConfigs.keys()].join(", ")}; got '${target}'.`);
}

const rootPackage = await readJson("package.json");
const version = options.version ?? rootPackage.version;
if (!semverPattern.test(version)) {
  fail(`--version must use x.y.z SemVer form; got '${version}'.`);
}
if (rootPackage.version !== version) {
  fail(`package.json version ${rootPackage.version} does not match requested desktop package version ${version}.`);
}

const bundleDir = path.resolve(
  rootDir,
  options.inputDir ?? path.join("src-tauri", "target", target, "release", "bundle")
);
const outputDir = path.resolve(rootDir, options.outputDir ?? defaultOutputDir);
const assetName = `skenion-studio-${target}.${config.archiveExtension}`;
const assetPath = path.join(outputDir, assetName);
const checksumPath = `${assetPath}.sha256`;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-studio-desktop-"));

try {
  const discoveredFiles = await collectRegularFiles(bundleDir);
  failIfUnexpectedLinuxAppImage(target, discoveredFiles);

  const artifacts = discoveredFiles
    .filter((candidate) => config.isArtifact(candidate.relativePath))
    .map((candidate) => ({
      ...candidate,
      family: config.familyFor(candidate.relativePath),
      archiveRelativePath: normalizeArchivePath(candidate.relativePath)
    }))
    .sort((left, right) => left.archiveRelativePath.localeCompare(right.archiveRelativePath));

  if (artifacts.length === 0) {
    fail(`Tauri bundle directory ${path.relative(rootDir, bundleDir)} does not contain package artifacts for ${target}.`);
  }

  const artifactFamilies = new Set(artifacts.map((artifact) => artifact.family));
  for (const requiredFamily of config.requiredFamilies) {
    if (!artifactFamilies.has(requiredFamily)) {
      fail(`Tauri bundle directory ${path.relative(rootDir, bundleDir)} is missing required ${requiredFamily} output for ${target}.`);
    }
  }

  await fs.mkdir(outputDir, { recursive: true });

  const packageDirName = `skenion-studio-${target}`;
  const packageDir = path.join(tempDir, packageDirName);
  await fs.mkdir(path.join(packageDir, "tauri"), { recursive: true });

  const readmePath = path.join(packageDir, "README.txt");
  await fs.writeFile(
    readmePath,
    [
      "skenion studio desktop package",
      `Version: ${version}`,
      `Target: ${target}`,
      `Canonical asset: ${assetName}`,
      "Contents: Tauri-generated desktop package artifacts for this target.",
      ""
    ].join("\n"),
    "utf8"
  );

  const archiveEntries = [
    {
      entryName: `${packageDirName}/README.txt`,
      filePath: readmePath
    }
  ];

  for (const artifact of artifacts) {
    const destination = path.join(packageDir, "tauri", ...artifact.archiveRelativePath.split("/"));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(artifact.filePath, destination);
    archiveEntries.push({
      entryName: `${packageDirName}/tauri/${artifact.archiveRelativePath}`,
      filePath: destination
    });
  }

  const tempAssetPath = path.join(tempDir, assetName);
  if (config.archiveExtension === "zip") {
    await writeZipArchive(tempAssetPath, archiveEntries);
    await validateZipArchive(tempAssetPath, archiveEntries.map((entry) => entry.entryName));
  } else {
    await run("tar", ["-czf", assetName, packageDirName], { cwd: tempDir });
    await validateTarGzArchive(tempAssetPath, archiveEntries.map((entry) => entry.entryName));
  }

  await fs.copyFile(tempAssetPath, assetPath);
  const checksum = await sha256(assetPath);
  await fs.writeFile(checksumPath, `${checksum}  ${assetName}\n`, "utf8");

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `asset_name=${assetName}`,
        `asset_path=${assetPath}`,
        `checksum_path=${checksumPath}`,
        `sha256=${checksum}`,
        `artifact_count=${artifacts.length}`,
        ""
      ].join("\n"),
      "utf8"
    );
  }

  console.log(`packaged ${path.relative(rootDir, assetPath)}`);
  console.log(`wrote ${path.relative(rootDir, checksumPath)}`);
  console.log(`included ${artifacts.length} Tauri artifact(s) for ${target}`);
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

async function collectRegularFiles(directory) {
  try {
    await fs.access(directory);
  } catch {
    fail(`Tauri bundle directory ${path.relative(rootDir, directory)} does not exist.`);
  }

  const files = [];
  await walk(directory);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  async function walk(currentDirectory) {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        files.push({
          filePath: entryPath,
          relativePath: path.relative(directory, entryPath)
        });
      }
    }
  }
}

function failIfUnexpectedLinuxAppImage(targetName, files) {
  if (!targetName.endsWith("-unknown-linux-gnu")) {
    return;
  }

  const appImage = files.find((file) => file.relativePath.toLowerCase().endsWith(".appimage"));
  if (appImage) {
    fail(
      `Linux release packaging is intentionally limited to deb/rpm, but Tauri emitted ${normalizeArchivePath(appImage.relativePath)}.`
    );
  }
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(rootDir, relativePath), "utf8"));
}

function normalizeArchivePath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function writeZipArchive(destination, entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.entryName, "utf8");
    const body = await fs.readFile(entry.filePath);
    const compressedBody = await deflateRawAsync(body);
    const checksum = crc32(body);
    assertZip32Size(body.length, entry.entryName);
    assertZip32Size(compressedBody.length, entry.entryName);
    assertZip32Size(offset, entry.entryName);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(33, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedBody.length, 18);
    localHeader.writeUInt32LE(body.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, compressedBody);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(33, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressedBody.length, 20);
    centralHeader.writeUInt32LE(body.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);

    offset += localHeader.length + nameBuffer.length + compressedBody.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  assertZip32Size(centralDirectory.length, "central directory");
  assertZip32Size(offset, "central directory offset");

  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  await fs.writeFile(destination, Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]));
}

async function validateZipArchive(filePath, expectedEntries) {
  const archive = await fs.readFile(filePath);
  if (archive.length < 22 || archive.readUInt32LE(0) !== 0x04034b50) {
    fail(`${path.basename(filePath)} is not a ZIP archive.`);
  }

  const entries = listZipEntries(archive);
  for (const expectedEntry of expectedEntries) {
    if (!entries.includes(expectedEntry)) {
      fail(`${path.basename(filePath)} is missing ZIP entry ${expectedEntry}.`);
    }
  }
}

async function validateTarGzArchive(filePath, expectedEntries) {
  const header = await fs.readFile(filePath);
  if (header[0] !== 0x1f || header[1] !== 0x8b) {
    fail(`${path.basename(filePath)} is not a gzip archive.`);
  }

  const entries = await listTarGzEntries(filePath);
  for (const expectedEntry of expectedEntries) {
    if (!entries.includes(expectedEntry)) {
      fail(`${path.basename(filePath)} is missing tar.gz entry ${expectedEntry}.`);
    }
  }
}

function listZipEntries(archive) {
  const eocdOffset = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0) {
    fail("ZIP archive is missing its end-of-central-directory record.");
  }

  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = archive.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = archive.readUInt32LE(eocdOffset + 16);
  if (centralDirectoryOffset + centralDirectorySize !== eocdOffset) {
    fail("ZIP archive has an invalid central directory.");
  }

  const entries = [];
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) {
      fail("ZIP archive has an invalid central directory entry.");
    }
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    entries.push(archive.subarray(nameStart, nameEnd).toString("utf8"));
    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

async function listTarGzEntries(filePath) {
  const output = await runAndCapture("tar", ["-tzf", path.basename(filePath)], {
    cwd: path.dirname(filePath)
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function assertZip32Size(size, label) {
  if (size > 0xffffffff) {
    fail(`ZIP entry ${label} is too large for the release desktop archive format.`);
  }
}

function crc32(buffer) {
  let checksum = 0xffffffff;
  for (const byte of buffer) {
    checksum = (checksum >>> 8) ^ crc32Table[(checksum ^ byte) & 0xff];
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let checksum = index;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = checksum & 1 ? 0xedb88320 ^ (checksum >>> 1) : checksum >>> 1;
    }
    table[index] = checksum >>> 0;
  }
  return table;
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

async function runAndCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "inherit"], ...options });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks).toString("utf8"));
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
