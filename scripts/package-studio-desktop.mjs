#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultOutputDir = path.join(rootDir, "artifacts", "studio-desktop");
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const targetConfigs = new Map([
  [
    "aarch64-apple-darwin",
    {
      requiredFamilies: ["dmg"],
      artifacts: [
        {
          family: "dmg",
          packageId: "macos-apple-silicon",
          filenamePlatform: "macos-apple-silicon",
          extension: ".dmg",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".dmg")
        }
      ]
    }
  ],
  [
    "x86_64-apple-darwin",
    {
      requiredFamilies: ["dmg"],
      artifacts: [
        {
          family: "dmg",
          packageId: "macos-intel",
          filenamePlatform: "macos-intel",
          extension: ".dmg",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".dmg")
        }
      ]
    }
  ],
  [
    "x86_64-pc-windows-msvc",
    {
      requiredFamilies: ["nsis-setup"],
      artifacts: [
        {
          family: "nsis-setup",
          packageId: "windows-x64",
          filenamePlatform: "windows-x64",
          extension: "-setup.exe",
          matches: isWindowsSetupExe
        },
        {
          family: "msi",
          packageId: "windows-x64-msi",
          filenamePlatform: "windows-x64",
          extension: ".msi",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".msi")
        }
      ]
    }
  ],
  [
    "aarch64-pc-windows-msvc",
    {
      requiredFamilies: ["nsis-setup"],
      artifacts: [
        {
          family: "nsis-setup",
          packageId: "windows-arm64",
          filenamePlatform: "windows-arm64",
          extension: "-setup.exe",
          matches: isWindowsSetupExe
        },
        {
          family: "msi",
          packageId: "windows-arm64-msi",
          filenamePlatform: "windows-arm64",
          extension: ".msi",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".msi")
        }
      ]
    }
  ],
  [
    "x86_64-unknown-linux-gnu",
    {
      requiredFamilies: ["deb", "rpm"],
      artifacts: [
        {
          family: "deb",
          packageId: "linux-x64-deb",
          filenamePlatform: "linux-x64",
          extension: ".deb",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".deb")
        },
        {
          family: "rpm",
          packageId: "linux-x64-rpm",
          filenamePlatform: "linux-x64",
          extension: ".rpm",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".rpm")
        }
      ]
    }
  ],
  [
    "aarch64-unknown-linux-gnu",
    {
      requiredFamilies: ["deb", "rpm"],
      artifacts: [
        {
          family: "deb",
          packageId: "linux-arm64-deb",
          filenamePlatform: "linux-arm64",
          extension: ".deb",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".deb")
        },
        {
          family: "rpm",
          packageId: "linux-arm64-rpm",
          filenamePlatform: "linux-arm64",
          extension: ".rpm",
          matches: (relativePath) => relativePath.toLowerCase().endsWith(".rpm")
        }
      ]
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
const manifestPath = path.join(outputDir, `skenion-studio-desktop-installers-${target}-v${version}.json`);

const discoveredFiles = await collectRegularFiles(bundleDir);
failIfUnexpectedLinuxAppImage(target, discoveredFiles);

const installers = [];
const seenFamilies = new Set();
for (const artifactConfig of config.artifacts) {
  const matches = discoveredFiles.filter((file) => artifactConfig.matches(normalizePath(file.relativePath)));
  if (matches.length === 0) {
    continue;
  }
  if (matches.length > 1) {
    fail(
      `Tauri bundle directory ${path.relative(rootDir, bundleDir)} contains multiple ${artifactConfig.family} outputs for ${target}: ${matches
        .map((file) => normalizePath(file.relativePath))
        .join(", ")}`
    );
  }

  seenFamilies.add(artifactConfig.family);
  installers.push({
    ...matches[0],
    family: artifactConfig.family,
    packageId: artifactConfig.packageId,
    filenamePlatform: artifactConfig.filenamePlatform,
    extension: artifactConfig.extension,
    sourceRelativePath: normalizePath(matches[0].relativePath)
  });
}

if (installers.length === 0) {
  fail(`Tauri bundle directory ${path.relative(rootDir, bundleDir)} does not contain installer artifacts for ${target}.`);
}

for (const requiredFamily of config.requiredFamilies) {
  if (!seenFamilies.has(requiredFamily)) {
    fail(`Tauri bundle directory ${path.relative(rootDir, bundleDir)} is missing required ${requiredFamily} output for ${target}.`);
  }
}

await fs.mkdir(outputDir, { recursive: true });

const manifestInstallers = [];
for (const installer of installers.sort((left, right) => left.packageId.localeCompare(right.packageId))) {
  const fileName = `skenion-studio-v${version}-${installer.filenamePlatform}${installer.extension}`;
  const destination = path.join(outputDir, fileName);
  const checksumPath = `${destination}.sha256`;

  await fs.copyFile(installer.filePath, destination);
  const checksum = await sha256(destination);
  const size = (await fs.stat(destination)).size;
  await fs.writeFile(checksumPath, `${checksum}  ${fileName}\n`, "utf8");

  manifestInstallers.push({
    packageId: installer.packageId,
    family: installer.family,
    filename: fileName,
    path: destination,
    checksumFilename: `${fileName}.sha256`,
    checksumPath,
    sha256: checksum,
    size,
    sourceRelativePath: installer.sourceRelativePath
  });
}

await fs.writeFile(
  manifestPath,
  JSON.stringify(
    {
      schema: "skenion.studio.desktopInstallers.v1",
      component: "skenion-studio",
      studioVersion: version,
      target,
      bundleDir,
      installers: manifestInstallers
    },
    null,
    2
  ) + "\n",
  "utf8"
);

if (process.env.GITHUB_OUTPUT) {
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    [
      `manifest_path=${manifestPath}`,
      `artifact_count=${manifestInstallers.length}`,
      `package_ids=${manifestInstallers.map((installer) => installer.packageId).join(",")}`,
      ""
    ].join("\n"),
    "utf8"
  );
}

console.log(`collected ${manifestInstallers.length} Tauri installer artifact(s) for ${target}`);
for (const installer of manifestInstallers) {
  console.log(`wrote ${path.relative(rootDir, installer.path)}`);
  console.log(`wrote ${path.relative(rootDir, installer.checksumPath)}`);
}
console.log(`wrote ${path.relative(rootDir, manifestPath)}`);

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
    fail(`Linux release packaging is intentionally limited to deb/rpm, but Tauri emitted ${normalizePath(appImage.relativePath)}.`);
  }
}

function isWindowsSetupExe(relativePath) {
  const normalized = normalizePath(relativePath).toLowerCase();
  return normalized.endsWith("-setup.exe") || (normalized.includes("/nsis/") && normalized.endsWith(".exe"));
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(rootDir, relativePath), "utf8"));
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
