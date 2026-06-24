#!/usr/bin/env node
import { spawn } from "node:child_process";

const semverTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const statusStart = "<!-- skenion-studio-release-status:start -->";
const statusEnd = "<!-- skenion-studio-release-status:end -->";
const studioRepo = process.env.GITHUB_REPOSITORY || "skenion/skenion-studio";
const releaseBlockingTargets = [
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu"
];
const allDesktopTargets = [
  ...releaseBlockingTargets,
  "aarch64-pc-windows-msvc",
  "aarch64-unknown-linux-gnu"
];

const options = parseArgs(process.argv.slice(2));
const mode = requireOption(options.mode, "--mode");
const releaseTag = requireOption(options.tag, "--tag");
const version = versionFromTag(releaseTag);

if (options.check) {
  runCheckMode();
} else {
  await updateRelease();
}

async function updateRelease() {
  if (!process.env.GH_TOKEN) {
    fail("GH_TOKEN is required to update Studio GitHub release status.");
  }

  const release = await ghJson(["api", `repos/${studioRepo}/releases/tags/${releaseTag}`]);
  const update = createStatusUpdate(release);
  const body = prependStatusBlock(release.body ?? "", update.statusBlock);
  await ghJson(
    ["api", "--method", "PATCH", `repos/${studioRepo}/releases/${release.id}`, "--input", "-"],
    {
      input: JSON.stringify({
        name: update.title,
        body,
        prerelease: update.prerelease
      })
    }
  );

  console.log(
    `marked ${releaseTag} as ${update.prerelease ? "prerelease/unpromoted" : "artifact-ready"}: ${update.summary}`
  );
}

function runCheckMode() {
  const release = {
    id: 1,
    body: "## Release notes\n\nSynthetic check release.",
    assets: syntheticAssetsForMode()
  };
  const update = createStatusUpdate(release);
  const body = prependStatusBlock(release.body, update.statusBlock);
  if (!body.includes(statusStart) || !body.includes(statusEnd)) {
    fail("release status marker was not inserted.");
  }
  console.log(`validated ${mode} status update for ${releaseTag}`);
  console.log(`title: ${update.title}`);
  console.log(`prerelease: ${update.prerelease}`);
}

function createStatusUpdate(release) {
  switch (mode) {
    case "release-please-created":
      return releasePleaseCreatedStatus(release);
    case "web-artifacts-published":
      return webArtifactsPublishedStatus(release);
    case "desktop-artifacts-published":
      return desktopArtifactsPublishedStatus(release);
    default:
      fail(
        "--mode must be release-please-created, web-artifacts-published, or desktop-artifacts-published."
      );
  }
}

function releasePleaseCreatedStatus(release) {
  const assetNames = assetNameSet(release);
  const productAssets = [
    ...legacyExpectedWebAssets(version),
    ...expectedWebAssets(version),
    ...legacyExpectedDesktopAssets(allDesktopTargets),
    ...expectedDesktopAssets(allDesktopTargets)
  ].filter((assetName) => assetNames.has(assetName));

  if (productAssets.length > 0) {
    fail(
      `refusing to mark ${releaseTag} as metadata-only because product assets already exist: ${productAssets.join(", ")}`
    );
  }

  return {
    title: `skenion-studio: v${version} (metadata only)`,
    prerelease: true,
    summary: "Release Please metadata only; no product artifacts are present",
    statusBlock: statusBlock([
      "**Studio release status:** Release Please metadata only.",
      "",
      `This GitHub Release is marked as a prerelease/unpromoted release because no Studio web artifact index or desktop package indexes have been published for \`${releaseTag}\` yet.`,
      "It is not a Studio distribution release and must not be treated as release-complete or product-ledger promoted."
    ])
  };
}

function webArtifactsPublishedStatus(release) {
  const missing = missingAssets(release, expectedWebAssets(version));
  if (missing.length > 0) {
    fail(`cannot mark ${releaseTag} as web-artifact evidence; missing assets: ${missing.join(", ")}`);
  }

  const runtimeTag = validateRuntimeTag(requireOption(options.runtimeTag, "--runtime-tag"));
  return {
    title: `skenion-studio: v${version} (web artifacts published)`,
    prerelease: true,
    summary: "DSUB web artifact index is present; desktop distribution is still pending",
    statusBlock: statusBlock([
      "**Studio release status:** Web artifact evidence published.",
      "",
      `GitHub Actions published the canonical Studio web bundle, checksum, desktop manifest metadata, and combined checksum manifest for \`${releaseTag}\` to DSUB release storage.`,
      `This GitHub Release carries the compact DSUB artifact index for those web artifacts; large web artifacts are not GitHub Release assets.`,
      `Runtime release metadata target: \`${runtimeTag}\`; Runtime binaries remain sourced from Runtime release artifacts.`,
      "This release remains prerelease/unpromoted until release-blocking desktop package indexes and signing evidence are present."
    ])
  };
}

function desktopArtifactsPublishedStatus(release) {
  const signingMode = requireOption(options.desktopSigningMode, "--desktop-signing-mode");
  if (!["unsigned-preview", "signed-required", "azure-trusted-signing"].includes(signingMode)) {
    fail(
      "--desktop-signing-mode must be unsigned-preview, signed-required, or azure-trusted-signing."
    );
  }

  const missingDesktop = missingAssets(release, expectedDesktopAssets(releaseBlockingTargets));
  if (missingDesktop.length > 0) {
    fail(
      `cannot mark ${releaseTag} as desktop-artifact evidence; missing release-blocking desktop indexes: ${missingDesktop.join(", ")}`
    );
  }

  const missingWeb = missingAssets(release, expectedWebAssets(version));
  const hasReleaseCompleteSigning = signingMode !== "unsigned-preview";
  const releaseCompleteAssets = missingWeb.length === 0 && hasReleaseCompleteSigning;
  const runtimeTag = validateRuntimeTag(requireOption(options.runtimeTag, "--runtime-tag"));

  if (releaseCompleteAssets) {
    return {
      title: `skenion-studio: v${version}`,
      prerelease: false,
      summary: "canonical web index and signed release-blocking desktop indexes are present",
      statusBlock: statusBlock([
        "**Studio release status:** Canonical product artifact set present.",
        "",
        `GitHub Actions verified the Studio web artifact index and release-blocking DSUB desktop package indexes for \`${releaseTag}\`.`,
        `Runtime release metadata target: \`${runtimeTag}\`; Runtime binaries remain sourced from Runtime release artifacts.`,
        "This release has the Studio artifact set required for distribution evidence. Product promotion must still be recorded in the product release ledger before reporting a promoted product line."
      ])
    };
  }

  const blockers = [];
  if (missingWeb.length > 0) {
    blockers.push(`missing web assets: ${missingWeb.join(", ")}`);
  }
  if (!hasReleaseCompleteSigning) {
    blockers.push("desktop-signing-mode is unsigned-preview");
  }

  return {
    title: `skenion-studio: v${version} (desktop artifacts published; unpromoted)`,
    prerelease: true,
    summary: `desktop indexes are present but release completion is blocked (${blockers.join("; ")})`,
    statusBlock: statusBlock([
      "**Studio release status:** Desktop artifact evidence published, not release-complete.",
      "",
      `GitHub Actions verified release-blocking Studio desktop package indexes for \`${releaseTag}\`.`,
      `Runtime release metadata target: \`${runtimeTag}\`; Runtime binaries remain sourced from Runtime release artifacts.`,
      `Release completion remains blocked because ${blockers.join("; ")}.`,
      "This release stays prerelease/unpromoted until the missing release-completion evidence is present."
    ])
  };
}

function expectedWebAssets(versionValue) {
  return [`skenion-studio-web-artifacts-v${versionValue}.index.json`];
}

function legacyExpectedWebAssets(versionValue) {
  const webAsset = `skenion-studio-web-bundle-v${versionValue}.tar.gz`;
  const desktopManifestAsset = `skenion-studio-desktop-manifest-v${versionValue}.json`;
  return [
    webAsset,
    `${webAsset}.sha256`,
    desktopManifestAsset,
    `${desktopManifestAsset}.sha256`,
    `skenion-studio-release-artifacts-v${versionValue}.sha256`
  ];
}

function expectedDesktopAssets(targets) {
  return targets.map((target) => `skenion-studio-desktop-${target}-v${version}.index.json`);
}

function legacyExpectedDesktopAssets(targets) {
  return targets.flatMap((target) => {
    const desktopAsset = `skenion-studio-${target}.${target.includes("windows") ? "zip" : "tar.gz"}`;
    return [desktopAsset, `${desktopAsset}.sha256`];
  });
}

function syntheticAssetsForMode() {
  switch (mode) {
    case "release-please-created":
      return [];
    case "web-artifacts-published":
      return expectedWebAssets(version).map((name) => ({ name }));
    case "desktop-artifacts-published":
      return [
        ...expectedWebAssets(version),
        ...expectedDesktopAssets(releaseBlockingTargets)
      ].map((name) => ({ name }));
    default:
      return [];
  }
}

function missingAssets(release, expectedAssets) {
  const assetNames = assetNameSet(release);
  return expectedAssets.filter((assetName) => !assetNames.has(assetName));
}

function assetNameSet(release) {
  return new Set((release.assets ?? []).map((asset) => asset.name).filter(Boolean));
}

function statusBlock(lines) {
  const quotedLines = lines.map((line) => (line.length > 0 ? `> ${line}` : ">"));
  return [statusStart, "> [!IMPORTANT]", ...quotedLines, statusEnd].join("\n");
}

function prependStatusBlock(body, block) {
  const stripped = stripStatusBlock(body).trimStart();
  return `${block}\n\n${stripped}`.trimEnd() + "\n";
}

function stripStatusBlock(body) {
  const pattern = new RegExp(`${escapeRegExp(statusStart)}[\\s\\S]*?${escapeRegExp(statusEnd)}\\n*`, "m");
  return (body ?? "").replace(pattern, "");
}

function versionFromTag(tag) {
  const match = tag.match(semverTagPattern);
  if (!match) {
    fail(`--tag must be vx.y.z; got '${tag}'.`);
  }
  return tag.slice("v".length);
}

function validateRuntimeTag(tag) {
  if (!semverTagPattern.test(tag)) {
    fail(`--runtime-tag must use vx.y.z; got '${tag}'.`);
  }
  return tag;
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      parsed.check = true;
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

async function ghJson(args, optionsForRun = {}) {
  const output = await run("gh", args, optionsForRun);
  return output.trim().length > 0 ? JSON.parse(output) : {};
}

function run(command, args, optionsForRun = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: childGhEnv()
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit ${code}\n${stderr}`));
    });
    if (optionsForRun.input) {
      child.stdin.end(optionsForRun.input);
    } else {
      child.stdin.end();
    }
  });
}

function childGhEnv() {
  const env = { ...process.env };
  env.GH_TOKEN = process.env.GH_TOKEN ?? "";
  delete env.GITHUB_TOKEN;
  return env;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
