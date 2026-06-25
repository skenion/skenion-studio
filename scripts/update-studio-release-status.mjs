#!/usr/bin/env node
import { spawn } from "node:child_process";

const semverTagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const statusStart = "<!-- skenion-studio-release-status:start -->";
const statusEnd = "<!-- skenion-studio-release-status:end -->";
const studioRepo = process.env.GITHUB_REPOSITORY || "skenion/skenion-studio";
const defaultPublicBaseUrl = "https://cdn.dsub.io/skenion/releases";

const options = parseArgs(process.argv.slice(2));
const mode = requireOption(options.mode, "--mode");
const releaseTag = requireOption(options.tag, "--tag");
const version = versionFromTag(releaseTag);
const publicBaseUrl = (options.publicBaseUrl || process.env.SKENION_RELEASE_PUBLIC_BASE_URL || defaultPublicBaseUrl).replace(/\/+$/, "");
const releaseBlockingDesktopPackages = createReleaseBlockingDesktopPackages(version);

if (options.check) {
  runCheckMode();
} else {
  await updateRelease();
}

async function updateRelease() {
  if (!process.env.GH_TOKEN) {
    fail("GH_TOKEN is required to update Studio GitHub release status.");
  }

  if (mode === "desktop-artifacts-published") {
    await verifyRequiredWebArtifactEvidence();
  }

  const release = await ghJson(["api", `repos/${studioRepo}/releases/tags/${releaseTag}`]);
  const update = createStatusUpdate();
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
  const update = createStatusUpdate();
  const body = prependStatusBlock("## Release notes\n\nSynthetic check release.", update.statusBlock);
  if (!body.includes(statusStart) || !body.includes(statusEnd)) {
    fail("release status marker was not inserted.");
  }
  console.log(`validated ${mode} status update for ${releaseTag}`);
  console.log(`title: ${update.title}`);
  console.log(`prerelease: ${update.prerelease}`);
}

function createStatusUpdate() {
  switch (mode) {
    case "release-please-created":
      return releasePleaseCreatedStatus();
    case "web-artifacts-published":
      return webArtifactsPublishedStatus();
    case "desktop-artifacts-published":
      return desktopArtifactsPublishedStatus();
    default:
      fail(
        "--mode must be release-please-created, web-artifacts-published, or desktop-artifacts-published."
      );
  }
}

function releasePleaseCreatedStatus() {
  return {
    title: `skenion-studio: v${version} (metadata only)`,
    prerelease: true,
    summary: "Release Please metadata only; product artifacts are not recorded yet",
    statusBlock: statusBlock([
      "**Studio release status:** Release Please metadata only.",
      "",
      `This GitHub Release is marked as a prerelease/unpromoted release because no Studio DSUB distribution links have been recorded for \`${releaseTag}\` yet.`,
      "It is not a Studio distribution release and must not be treated as release-complete or product-ledger promoted."
    ])
  };
}

function webArtifactsPublishedStatus() {
  const runtimeTag = validateRuntimeTag(requireOption(options.runtimeTag, "--runtime-tag"));
  const web = webLinks();
  return {
    title: `skenion-studio: v${version} (web artifacts published)`,
    prerelease: true,
    summary: "DSUB web artifact links recorded; desktop installers are still pending",
    statusBlock: statusBlock([
      "**Studio release status:** Web artifact evidence published.",
      "",
      `GitHub Actions published the Studio web bundle and metadata for \`${releaseTag}\` to DSUB release storage. GitHub Release assets are not used as artifact evidence.`,
      `Runtime release metadata target: \`${runtimeTag}\`; Runtime binaries remain sourced from Runtime release artifacts.`,
      "",
      "**Web downloads:**",
      linkLine("Web artifact index", web.index),
      linkLine("Web bundle", web.bundle, web.bundleChecksum),
      linkLine("Desktop release metadata", web.desktopManifest, web.desktopManifestChecksum),
      linkLine("Combined checksum manifest", web.combinedChecksum),
      "",
      "This release remains prerelease/unpromoted until release-blocking desktop installer links are recorded."
    ])
  };
}

function desktopArtifactsPublishedStatus() {
  const runtimeTag = validateRuntimeTag(requireOption(options.runtimeTag, "--runtime-tag"));
  const signingMode = requireOption(options.desktopSigningMode, "--desktop-signing-mode");
  if (!["unsigned-preview", "signed-required", "azure-trusted-signing"].includes(signingMode)) {
    fail("--desktop-signing-mode must be unsigned-preview, signed-required, or azure-trusted-signing.");
  }

  const web = webLinks();
  const desktop = releaseBlockingDesktopPackages.flatMap((desktopPackage) => {
    const links = desktopLinks(desktopPackage);
    return [linkLine(desktopPackage.label, links.installer, links.checksum)];
  });

  return {
    title: `skenion-studio: v${version}`,
    prerelease: false,
    summary: "DSUB web and release-blocking desktop installer links recorded",
    statusBlock: statusBlock([
      "**Studio release status:** Product distribution artifact links recorded.",
      "",
      `GitHub Actions recorded the Studio web artifact set and release-blocking desktop installer set for \`${releaseTag}\`. GitHub Release assets are not used as artifact evidence.`,
      `Runtime release metadata target: \`${runtimeTag}\`; Runtime binaries remain sourced from Runtime release artifacts.`,
      `Desktop signing mode recorded: \`${signingMode}\`.`,
      "",
      "**Web downloads:**",
      linkLine("Web artifact index", web.index),
      linkLine("Web bundle", web.bundle, web.bundleChecksum),
      linkLine("Desktop release metadata", web.desktopManifest, web.desktopManifestChecksum),
      linkLine("Combined checksum manifest", web.combinedChecksum),
      "",
      "**Desktop downloads:**",
      ...desktop,
      "",
      "Product promotion must still be recorded in the product release ledger before reporting a promoted product line."
    ])
  };
}

function webLinks() {
  const base = `${publicBaseUrl}/skenion-studio/${releaseTag}/web`;
  const webBundle = `skenion-studio-web-bundle-v${version}.tar.gz`;
  const desktopManifest = `skenion-studio-desktop-manifest-v${version}.json`;
  return {
    index: `${base}/skenion-studio-web-artifacts-v${version}.index.json`,
    bundle: `${base}/${webBundle}`,
    bundleChecksum: `${base}/${webBundle}.sha256`,
    desktopManifest: `${base}/${desktopManifest}`,
    desktopManifestChecksum: `${base}/${desktopManifest}.sha256`,
    combinedChecksum: `${base}/skenion-studio-release-artifacts-v${version}.sha256`
  };
}

function createReleaseBlockingDesktopPackages(versionValue) {
  return [
    {
      id: "macos-apple-silicon",
      label: "macOS Apple Silicon",
      filename: `skenion-studio-v${versionValue}-macos-apple-silicon.dmg`
    },
    {
      id: "macos-intel",
      label: "macOS Intel",
      filename: `skenion-studio-v${versionValue}-macos-intel.dmg`
    },
    {
      id: "windows-x64",
      label: "Windows x64",
      filename: `skenion-studio-v${versionValue}-windows-x64-setup.exe`
    },
    {
      id: "linux-x64-deb",
      label: "Linux x64 deb",
      filename: `skenion-studio-v${versionValue}-linux-x64.deb`
    },
    {
      id: "linux-x64-rpm",
      label: "Linux x64 rpm",
      filename: `skenion-studio-v${versionValue}-linux-x64.rpm`
    }
  ];
}

async function verifyRequiredWebArtifactEvidence() {
  const web = webLinks();
  const requiredUrls = [
    ["web artifact index", web.index],
    ["web bundle", web.bundle],
    ["web bundle checksum", web.bundleChecksum],
    ["desktop release metadata", web.desktopManifest],
    ["desktop release metadata checksum", web.desktopManifestChecksum],
    ["combined checksum manifest", web.combinedChecksum]
  ];

  for (const [label, url] of requiredUrls) {
    await verifyPublicUrlExists(label, url);
  }
}

async function verifyPublicUrlExists(label, url) {
  let response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    fail(`cannot mark ${releaseTag} release-complete; required DSUB ${label} is not reachable: ${url} (${error.message})`);
  }

  if (!response.ok) {
    fail(`cannot mark ${releaseTag} release-complete; required DSUB ${label} returned HTTP ${response.status}: ${url}`);
  }
}

function desktopLinks(desktopPackage) {
  const base = `${publicBaseUrl}/skenion-studio/${releaseTag}/desktop/${desktopPackage.id}`;
  return {
    installer: `${base}/${desktopPackage.filename}`,
    checksum: `${base}/${desktopPackage.filename}.sha256`
  };
}

function linkLine(label, primaryUrl, checksumUrl) {
  if (!checksumUrl) {
    return `- ${label}: ${primaryUrl}`;
  }
  return `- ${label}: ${primaryUrl} (checksum: ${checksumUrl})`;
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
