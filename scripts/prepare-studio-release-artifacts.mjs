#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const studioRepo = "skenion/skenion-studio";
const studioRepoUrl = `https://github.com/${studioRepo}`;
const runtimeRepo = "skenion/skenion-runtime";
const artifactPackageDefinitions = [
  {
    name: "@skenion/studio-web",
    directory: "packages/studio-web",
    manifestFile: "studio-web-manifest.json"
  },
  {
    name: "@skenion/studio-desktop",
    directory: "packages/studio-desktop",
    manifestFile: "studio-desktop-manifest.json"
  }
];
const desktopTargets = [
  {
    target: "aarch64-apple-darwin",
    tier: "release-blocking",
    tauriBundleArgs: []
  },
  {
    target: "x86_64-apple-darwin",
    tier: "release-blocking",
    tauriBundleArgs: []
  },
  {
    target: "x86_64-pc-windows-msvc",
    tier: "release-blocking",
    tauriBundleArgs: []
  },
  {
    target: "x86_64-unknown-linux-gnu",
    tier: "release-blocking",
    tauriBundleArgs: ["--bundles", "deb,rpm"]
  },
  {
    target: "aarch64-pc-windows-msvc",
    tier: "preview",
    tauriBundleArgs: []
  },
  {
    target: "aarch64-unknown-linux-gnu",
    tier: "preview",
    tauriBundleArgs: ["--bundles", "deb,rpm"]
  }
];

const options = parseArgs(process.argv.slice(2));
const rootPackage = await readJson("package.json");
const version = options.version ?? rootPackage.version;
const releaseTag = options.tag ?? `skenion-studio-v${version}`;
const trainId = version.split(".").slice(0, 2).join(".");
const checkOnly = Boolean(options.check);
const distDir = path.resolve(rootDir, options.distDir ?? "dist");

validateReleaseInputs(version, releaseTag);
await validatePackageVersions(version, rootPackage);

const webManifest = createWebManifest(version, trainId, releaseTag);
const desktopManifest = createDesktopManifest(version, trainId, releaseTag);

if (!checkOnly) {
  await copyWebDist(distDir, path.join(rootDir, "packages/studio-web/dist"));
  await writeJson("packages/studio-web/studio-web-manifest.json", webManifest);
  await writeJson("packages/studio-desktop/studio-desktop-manifest.json", desktopManifest);
  console.log(`prepared skenion studio web bundle metadata for ${version}`);
  console.log(`prepared skenion studio desktop release metadata for ${version}`);
} else {
  console.log(`validated skenion studio release artifact metadata for ${releaseTag}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      parsed.check = true;
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

async function validatePackageVersions(expectedVersion, rootPackageJson) {
  assertEqual(rootPackageJson.version, expectedVersion, "package.json version");
  assertEqual(
    rootPackageJson.dependencies?.["@skenion/contracts"],
    expectedVersion,
    "package.json dependencies.@skenion/contracts"
  );

  const tauriConfig = await readJson("src-tauri/tauri.conf.json");
  assertEqual(tauriConfig.version, expectedVersion, "src-tauri/tauri.conf.json version");

  const cargoToml = await fs.readFile(path.join(rootDir, "src-tauri/Cargo.toml"), "utf8");
  const cargoVersion = cargoToml.match(/^version = "([^"]+)"$/m)?.[1];
  assertEqual(cargoVersion, expectedVersion, "src-tauri/Cargo.toml package.version");

  for (const definition of artifactPackageDefinitions) {
    const packageJson = await readJson(`${definition.directory}/package.json`);
    assertEqual(packageJson.name, definition.name, `${definition.directory}/package.json name`);
    assertEqual(packageJson.version, expectedVersion, `${definition.directory}/package.json version`);
    assertEqual(
      packageJson.peerDependencies?.["@skenion/contracts"],
      expectedVersion,
      `${definition.directory}/package.json peerDependencies.@skenion/contracts`
    );
    if (packageJson.private !== true) {
      fail(`${definition.directory}/package.json must be private because Studio artifacts are not npm packages.`);
    }
    if (packageJson.publishConfig !== undefined) {
      fail(`${definition.directory}/package.json must not define publishConfig.`);
    }
    assertEqual(
      packageJson.repository?.url,
      studioRepoUrl,
      `${definition.directory}/package.json repository.url`
    );
    if (!packageJson.files?.includes(definition.manifestFile)) {
      fail(`${definition.directory}/package.json files must include ${definition.manifestFile}.`);
    }
  }
}

function validateReleaseInputs(expectedVersion, releaseTagValue) {
  if (!semverPattern.test(expectedVersion)) {
    fail(`version must use x.y.z SemVer form; got '${expectedVersion}'.`);
  }
  if (releaseTagValue !== `skenion-studio-v${expectedVersion}`) {
    fail(`release tag ${releaseTagValue} must match skenion-studio-v${expectedVersion}.`);
  }
}

function createWebManifest(versionValue, trainIdValue, releaseTagValue) {
  return {
    "schema-version": "0.1",
    component: "studio-web",
    version: versionValue,
    "train-id": trainIdValue,
    contracts: {
      "npm-package": "@skenion/contracts",
      version: versionValue
    },
    "studio-release": {
      repository: studioRepo,
      tag: releaseTagValue,
      url: `https://github.com/${studioRepo}/releases/tag/${releaseTagValue}`
    },
    artifact: {
      kind: "studio-web-bundle",
      name: `skenion-studio-web-bundle-v${versionValue}.tar.gz`,
      "checksum-name": `skenion-studio-web-bundle-v${versionValue}.tar.gz.sha256`,
      url: `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/skenion-studio-web-bundle-v${versionValue}.tar.gz`,
      "checksum-url": `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/skenion-studio-web-bundle-v${versionValue}.tar.gz.sha256`,
      directory: "dist",
      entrypoint: "dist/index.html"
    }
  };
}

function createDesktopManifest(versionValue, trainIdValue, releaseTagValue) {
  const runtimeTag = `skenion-runtime-v${versionValue}`;
  return {
    "schema-version": "0.1",
    component: "studio-desktop",
    version: versionValue,
    "train-id": trainIdValue,
    contracts: {
      "npm-package": "@skenion/contracts",
      version: versionValue
    },
    "studio-release": {
      repository: studioRepo,
      tag: releaseTagValue,
      url: `https://github.com/${studioRepo}/releases/tag/${releaseTagValue}`
    },
    artifact: {
      kind: "tauri-desktop-release",
      distribution: "github-release-assets",
      "desktop-package-pattern": "skenion-studio-<target>.<tar.gz|zip>",
      "checksum-pattern": "skenion-studio-<target>.<tar.gz|zip>.sha256",
      "linux-package-contents": ["deb", "rpm"],
      "windows-package-contents": ["nsis-setup-exe", "msi-if-emitted"]
    },
    runtime: {
      repository: runtimeRepo,
      version: versionValue,
      tag: runtimeTag,
      url: `https://github.com/${runtimeRepo}/releases/tag/${runtimeTag}`
    },
    "desktop-packages": desktopTargets.map((target) => createDesktopPackageTarget(releaseTagValue, target)),
    "runtime-sidecars": desktopTargets.map((target) => createSidecarTarget(versionValue, releaseTagValue, runtimeTag, target))
  };
}

function createDesktopPackageTarget(releaseTagValue, targetConfig) {
  const packageAssetName = `skenion-studio-${targetConfig.target}.${desktopPackageExtension(targetConfig.target)}`;
  return {
    target: targetConfig.target,
    tier: targetConfig.tier,
    "tauri-bundle-args": targetConfig.tauriBundleArgs,
    "package-asset": {
      name: packageAssetName,
      "checksum-name": `${packageAssetName}.sha256`,
      url: `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/${packageAssetName}`,
      "checksum-url": `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/${packageAssetName}.sha256`
    }
  };
}

function createSidecarTarget(versionValue, releaseTagValue, runtimeTag, targetConfig) {
  const runtimeAssetName = `skenion-runtime-v${versionValue}-${targetConfig.target}.tar.gz`;
  const studioSidecarExtension = targetConfig.target.includes("windows") ? "zip" : "tar.gz";
  const studioSidecarAssetName = `skenion-runtime-sidecar-${targetConfig.target}.${studioSidecarExtension}`;
  return {
    target: targetConfig.target,
    tier: targetConfig.tier,
    "tauri-bundle-args": targetConfig.tauriBundleArgs,
    "runtime-release-asset": {
      name: runtimeAssetName,
      "checksum-name": `${runtimeAssetName}.sha256`,
      url: `https://github.com/${runtimeRepo}/releases/download/${runtimeTag}/${runtimeAssetName}`,
      "checksum-url": `https://github.com/${runtimeRepo}/releases/download/${runtimeTag}/${runtimeAssetName}.sha256`
    },
    "studio-runtime-sidecar-asset": {
      name: studioSidecarAssetName,
      "checksum-name": `${studioSidecarAssetName}.sha256`,
      url: `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/${studioSidecarAssetName}`,
      "checksum-url": `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/${studioSidecarAssetName}.sha256`
    }
  };
}

function desktopPackageExtension(target) {
  return target.includes("windows") ? "zip" : "tar.gz";
}

async function copyWebDist(source, destination) {
  await fs.access(path.join(source, "index.html"));
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
}

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(rootDir, relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  await fs.writeFile(
    path.join(rootDir, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
    "utf8"
  );
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} is ${actual ?? "<missing>"}, expected ${expected}.`);
  }
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
