#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const contractsLine = "0.45";
const contractsRange = ">=0.45.0 <0.46.0";
const runtimeApiBaseline = "0.1.0";
const runtimeProtocolBaseline = "0.1.0";
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
const releaseTag = options.tag ?? `v${version}`;
const runtimeTag = requireOption(options.runtimeTag, "--runtime-tag");
const runtimeVersion = runtimeVersionFromTag(runtimeTag);
const checkOnly = Boolean(options.check);
const distDir = path.resolve(rootDir, options.distDir ?? "dist");

validateReleaseInputs(version, releaseTag);
await validatePackageVersions(version, rootPackage);

const webManifest = createWebManifest(version, releaseTag, rootPackage.dependencies["@skenion/contracts"]);
const desktopManifest = createDesktopManifest(
  version,
  releaseTag,
  runtimeTag,
  runtimeVersion,
  rootPackage.dependencies["@skenion/contracts"]
);

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
  assertConcreteContractsVersion(
    rootPackageJson.dependencies?.["@skenion/contracts"],
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
      contractsRange,
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
  if (releaseTagValue !== `v${expectedVersion}`) {
    fail(`release tag ${releaseTagValue} must match v${expectedVersion}.`);
  }
}

function createWebManifest(versionValue, releaseTagValue, contractsVersion) {
  const webAssetName = `skenion-studio-web-bundle-v${versionValue}.tar.gz`;
  const webChecksumName = `${webAssetName}.sha256`;
  const distribution = createWebDsubDistribution(releaseTagValue, webAssetName, webChecksumName);

  return {
    "schema-version": "0.1",
    component: "studio-web",
    version: versionValue,
    contracts: {
      "npm-package": "@skenion/contracts",
      line: contractsLine,
      range: contractsRange,
      version: contractsVersion
    },
    "studio-release": {
      repository: studioRepo,
      tag: releaseTagValue,
      url: `https://github.com/${studioRepo}/releases/tag/${releaseTagValue}`
    },
    artifact: {
      kind: "studio-web-bundle",
      distribution: "dsub-s3",
      name: webAssetName,
      "checksum-name": webChecksumName,
      url: distribution.url,
      "checksum-url": distribution.checksumUrl,
      dsub: distribution.dsub,
      directory: "dist",
      entrypoint: "dist/index.html"
    }
  };
}

function createDesktopManifest(versionValue, releaseTagValue, runtimeTagValue, runtimeVersionValue, contractsVersion) {
  return {
    "schema-version": "0.1",
    component: "studio-desktop",
    version: versionValue,
    contracts: {
      "npm-package": "@skenion/contracts",
      line: contractsLine,
      range: contractsRange,
      version: contractsVersion
    },
    "studio-release": {
      repository: studioRepo,
      tag: releaseTagValue,
      url: `https://github.com/${studioRepo}/releases/tag/${releaseTagValue}`
    },
    artifact: {
      kind: "tauri-desktop-release",
      distribution: "dsub-s3",
      "desktop-package-path-pattern": "skenion-studio/<release-tag>/desktop/<target>/skenion-studio-<target>.<tar.gz|zip>",
      "checksum-pattern": "skenion-studio-<target>.<tar.gz|zip>.sha256",
      "index-pattern": "skenion-studio-desktop-<target>-v<version>.index.json",
      "github-release-asset-pattern": "skenion-studio-desktop-<target>-v<version>.index.json",
      "linux-package-contents": ["deb", "rpm"],
      "windows-package-contents": ["nsis-setup-exe", "msi-if-emitted"]
    },
    runtime: {
      repository: runtimeRepo,
      version: runtimeVersionValue,
      tag: runtimeTagValue,
      url: `https://github.com/${runtimeRepo}/releases/tag/${runtimeTagValue}`,
      "binary-source": "skenion-runtime-release-manifest",
      "manifest-schema": "skenion.runtime.releaseArtifact.v1",
      "api-baseline": runtimeApiBaseline,
      "protocol-baseline": runtimeProtocolBaseline
    },
    "desktop-packages": desktopTargets.map((target) => createDesktopPackageTarget(releaseTagValue, target)),
    "runtime-release-manifests": desktopTargets.map((target) =>
      createRuntimeManifestTarget(runtimeVersionValue, runtimeTagValue, target)
    )
  };
}

function createDesktopPackageTarget(releaseTagValue, targetConfig) {
  const packageAssetName = `skenion-studio-${targetConfig.target}.${desktopPackageExtension(targetConfig.target)}`;
  const packageChecksumName = `${packageAssetName}.sha256`;
  const indexName = `skenion-studio-desktop-${targetConfig.target}-${releaseTagValue}.index.json`;
  const distribution = createDesktopDsubDistribution(releaseTagValue, targetConfig.target, {
    assetName: packageAssetName,
    checksumName: packageChecksumName,
    indexName
  });
  return {
    target: targetConfig.target,
    tier: targetConfig.tier,
    "tauri-bundle-args": targetConfig.tauriBundleArgs,
    "package-asset": {
      name: packageAssetName,
      "checksum-name": packageChecksumName,
      distribution: "dsub-s3",
      url: distribution.asset.url,
      "checksum-url": distribution.checksum.url,
      dsub: distribution.asset.dsub,
      "checksum-dsub": distribution.checksum.dsub
    },
    "desktop-index": {
      name: indexName,
      distribution: "github-release-asset-and-dsub-s3",
      url: `https://github.com/${studioRepo}/releases/download/${releaseTagValue}/${indexName}`,
      "dsub-url": distribution.index.url,
      dsub: distribution.index.dsub
    }
  };
}

function createRuntimeManifestTarget(versionValue, runtimeTag, targetConfig) {
  const runtimeAssetName = `skenion-runtime-v${versionValue}-${targetConfig.target}.tar.gz`;
  const runtimeManifestName = `${runtimeAssetName}.manifest.json`;
  return {
    target: targetConfig.target,
    tier: targetConfig.tier,
    "tauri-bundle-args": targetConfig.tauriBundleArgs,
    "runtime-release-artifact-manifest": {
      schema: "skenion.runtime.releaseArtifact.v1",
      component: "skenion-runtime",
      name: runtimeManifestName,
      url: `https://github.com/${runtimeRepo}/releases/download/${runtimeTag}/${runtimeManifestName}`,
      "artifact-filename": runtimeAssetName,
      "checksum-filename": `${runtimeAssetName}.sha256`
    }
  };
}

function desktopPackageExtension(target) {
  return target.includes("windows") ? "zip" : "tar.gz";
}

function createWebDsubDistribution(releaseTagValue, assetName, checksumName) {
  const publicBaseUrl = normalizeBaseUrl(process.env.SKENION_RELEASE_PUBLIC_BASE_URL);
  const bucket = process.env.SKENION_RELEASE_S3_BUCKET || null;
  const prefix = trimSlashes(process.env.SKENION_RELEASE_S3_PREFIX || "");
  const assetPath = `skenion-studio/${releaseTagValue}/web/${assetName}`;
  const checksumPath = `skenion-studio/${releaseTagValue}/web/${checksumName}`;
  const assetKey = prefix ? `${prefix}/${assetPath}` : assetPath;
  const checksumKey = prefix ? `${prefix}/${checksumPath}` : checksumPath;

  return {
    url: publicBaseUrl ? `${publicBaseUrl}/${assetPath}` : null,
    checksumUrl: publicBaseUrl ? `${publicBaseUrl}/${checksumPath}` : null,
    dsub: {
      bucket,
      "public-base-url": publicBaseUrl,
      "asset-path": assetPath,
      "checksum-path": checksumPath,
      "asset-key": assetKey,
      "checksum-key": checksumKey
    }
  };
}

function createDesktopDsubDistribution(releaseTagValue, target, names) {
  const publicBaseUrl = normalizeBaseUrl(process.env.SKENION_RELEASE_PUBLIC_BASE_URL);
  const bucket = process.env.SKENION_RELEASE_S3_BUCKET || null;
  const prefix = trimSlashes(process.env.SKENION_RELEASE_S3_PREFIX || "");
  const directory = `skenion-studio/${releaseTagValue}/desktop/${target}`;

  return {
    asset: createDsubObjectDistribution(publicBaseUrl, bucket, prefix, `${directory}/${names.assetName}`),
    checksum: createDsubObjectDistribution(publicBaseUrl, bucket, prefix, `${directory}/${names.checksumName}`),
    index: createDsubObjectDistribution(publicBaseUrl, bucket, prefix, `${directory}/${names.indexName}`)
  };
}

function createDsubObjectDistribution(publicBaseUrl, bucket, prefix, objectPath) {
  const key = prefix ? `${prefix}/${objectPath}` : objectPath;
  return {
    url: publicBaseUrl ? `${publicBaseUrl}/${objectPath}` : null,
    dsub: {
      bucket,
      "public-base-url": publicBaseUrl,
      path: objectPath,
      key
    }
  };
}

function normalizeBaseUrl(value) {
  if (!value) {
    return null;
  }
  return value.replace(/\/+$/, "");
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
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

function assertConcreteContractsVersion(version, label) {
  if (!version || !semverPattern.test(version)) {
    fail(`${label} must be a concrete x.y.z package version in the ${contractsLine} line; got ${version ?? "<missing>"}.`);
  }
  if (!versionSatisfiesContractsLine(version)) {
    fail(`${label} ${version} must satisfy ${contractsRange}.`);
  }
}

function versionSatisfiesContractsLine(version) {
  const [major, minor] = version.split(".").map(Number);
  return major === 0 && minor === 45;
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
