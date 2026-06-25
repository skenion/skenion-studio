#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(rootDir, ".github", "workflows");
const failures = [];

const studioReleaseWorkflowPath = ".github/workflows/studio-release-artifacts.yml";
const desktopReleaseWorkflowPath = ".github/workflows/desktop-release.yml";
const packageDesktopPath = "scripts/package-studio-desktop.mjs";
const prepareArtifactsPath = "scripts/prepare-studio-release-artifacts.mjs";
const stageRuntimePath = "scripts/stage-runtime-sidecar.mjs";
const webPublisherPath = "scripts/publish-studio-asset-s3.sh";
const desktopPublisherPath = "scripts/publish-studio-desktop-asset-s3.sh";
const statusScriptPath = "scripts/update-studio-release-status.mjs";
const desktopReadmePath = "packages/studio-desktop/README.md";
const webReadmePath = "packages/studio-web/README.md";
const ciPolicyPath = "docs/ci-release-policy.md";

const workflowPaths = fs
  .readdirSync(workflowDir)
  .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
  .map((fileName) => `.github/workflows/${fileName}`)
  .sort();

const studioReleaseWorkflow = readRequired(studioReleaseWorkflowPath);
const desktopReleaseWorkflow = readRequired(desktopReleaseWorkflowPath);
const packageDesktop = readRequired(packageDesktopPath);
const prepareArtifacts = readRequired(prepareArtifactsPath);
const stageRuntime = readRequired(stageRuntimePath);
const webPublisher = readRequired(webPublisherPath);
const desktopPublisher = readRequired(desktopPublisherPath);
const statusScript = readRequired(statusScriptPath);
const desktopReadme = readRequired(desktopReadmePath);
const webReadme = readRequired(webReadmePath);
const ciPolicy = readRequired(ciPolicyPath);

for (const workflowPath of workflowPaths) {
  const workflow = readRequired(workflowPath);
  checkTokenPolicy(workflowPath, workflow);
  checkNoLocalPublish(workflowPath, workflow);
  checkNoReleaseActionBypass(workflowPath, workflow);
}

checkNoGithubReleaseUploads(studioReleaseWorkflowPath, studioReleaseWorkflow);
checkNoGithubReleaseUploads(desktopReleaseWorkflowPath, desktopReleaseWorkflow);
checkNoDirectS3WorkflowUpload(studioReleaseWorkflowPath, studioReleaseWorkflow);
checkNoDirectS3WorkflowUpload(desktopReleaseWorkflowPath, desktopReleaseWorkflow);
checkReleaseWorkflows();
checkPublisherScripts();
checkDesktopPackaging();
checkPrepareArtifactsPolicy();
checkRuntimeSidecarPolicy();
checkReleaseStatusPolicy();
checkDocsPolicy();

if (failures.length > 0) {
  console.error("Studio release workflow policy validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Validated Studio release workflow artifact policy.");

function checkTokenPolicy(relativePath, content) {
  rejectPattern(
    relativePath,
    content,
    /\bRELEASE_PLEASE_TOKEN\b/,
    "release workflows must not introduce RELEASE_PLEASE_TOKEN fallbacks; use the organization GH_TOKEN secret"
  );
  rejectPattern(
    relativePath,
    content,
    /\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}|\$\{\{\s*github\.token\s*\}\}/,
    "release mutation tokens must come from secrets.GH_TOKEN, not the default GitHub token"
  );
}

function checkNoLocalPublish(relativePath, content) {
  for (const { line, text } of shellCommandLines(content)) {
    const command = text.replace(/^run:\s*/, "").trim();
    if (command.startsWith("echo ") || command.startsWith("#")) {
      continue;
    }
    if (/^(?:npm|pnpm)\s+publish\b/.test(command) && !/\s--dry-run\b/.test(command)) {
      fail(relativePath, line, "workflows must not publish npm packages from Studio release jobs");
    }
    if (/^cargo\s+publish\b/.test(command) && !/\s--dry-run\b/.test(command)) {
      fail(relativePath, line, "workflows must not publish crates from Studio release jobs");
    }
  }
}

function checkNoReleaseActionBypass(relativePath, content) {
  rejectPattern(
    relativePath,
    content,
    /\b(?:softprops\/action-gh-release|actions\/upload-release-asset|actions\/create-release|ncipollo\/release-action|svenstaro\/upload-release-action)\b/i,
    "release assets must not bypass the reviewed GH_TOKEN and DSUB publisher steps"
  );
}

function checkNoGithubReleaseUploads(relativePath, content) {
  rejectPattern(
    relativePath,
    content,
    /\bgh\s+release\s+upload\b/,
    "Studio release workflows must not upload DSUB indexes or product artifacts to GitHub Release assets"
  );
  rejectPattern(
    relativePath,
    content,
    /\bgh\s+release\s+(?:download|view)\b[\s\S]{0,200}\bassets\b/,
    "Studio release workflows must not depend on GitHub Release assets for artifact evidence"
  );
}

function checkNoDirectS3WorkflowUpload(relativePath, content) {
  for (const { line, text } of shellCommandLines(content)) {
    const command = text.replace(/^run:\s*/, "").trim();
    if (command.startsWith("echo ") || command.startsWith("#")) {
      continue;
    }
    if (/\baws\b.*\bs3(?:api)?\b.*\b(cp|sync|put-object|create-multipart-upload|upload-part|complete-multipart-upload)\b/.test(command)) {
      fail(
        relativePath,
        line,
        "release workflows must call the Studio DSUB publisher scripts instead of uploading directly to S3"
      );
    }
  }
}

function checkReleaseWorkflows() {
  const webPublishStep = requireStep(studioReleaseWorkflowPath, studioReleaseWorkflow, "Publish Studio web artifacts to DSUB S3");
  expectIncludes(
    studioReleaseWorkflowPath,
    webPublishStep,
    `${webPublisherPath} \\`,
    "web release publish step must use the Studio DSUB S3 publisher"
  );
  expectIncludes(
    studioReleaseWorkflowPath,
    webPublishStep,
    "--use-existing-manifest",
    "web release publish step must reuse the dry-run manifest before uploading"
  );

  const webStatusStep = requireStep(studioReleaseWorkflowPath, studioReleaseWorkflow, "Mark release as web artifact evidence");
  expectIncludes(
    studioReleaseWorkflowPath,
    webStatusStep,
    "SKENION_RELEASE_PUBLIC_BASE_URL: ${{ secrets.SKENION_RELEASE_PUBLIC_BASE_URL }}",
    "web release status must receive the DSUB public base URL"
  );

  const packageStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Collect skenion studio desktop installers");
  expectIncludes(
    desktopReleaseWorkflowPath,
    packageStep,
    "pnpm run package-studio-desktop",
    "desktop release workflow must collect real Tauri installer artifacts"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    packageStep,
    "--target \"${TARGET}\"",
    "desktop installer collection must keep the internal Rust target only as a build input"
  );

  const runtimeVerifyStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Stage Runtime binary from release manifest (verify HTTP)");
  checkRuntimeStagingWorkflowStep(runtimeVerifyStep, "http");

  const runtimePublishStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Stage Runtime binary from release manifest (publish S3)");
  checkRuntimeStagingWorkflowStep(runtimePublishStep, "s3");

  const desktopPublishStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Publish skenion studio desktop package to DSUB S3");
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopPublishStep,
    `${desktopPublisherPath} \\`,
    "desktop package publish step must use the Studio desktop DSUB S3 publisher"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopPublishStep,
    "${{ steps.package_studio_desktop.outputs.manifest_path }}",
    "desktop publisher must consume the installer manifest rather than a wrapper archive"
  );

  const desktopStatusStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Mark release as desktop artifact evidence");
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopStatusStep,
    "SKENION_RELEASE_PUBLIC_BASE_URL: ${{ secrets.SKENION_RELEASE_PUBLIC_BASE_URL }}",
    "desktop release status must receive the DSUB public base URL"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopStatusStep,
    "--mode desktop-artifacts-published",
    "desktop release completion path must use the status updater's desktop artifact mode"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /unsigned-preview[\s\S]{0,120}non-release-complete|non-release-complete[\s\S]{0,120}unsigned-preview/,
    "desktop release workflow must not describe unsigned-preview as inherently non-release-complete"
  );
}

function checkRuntimeStagingWorkflowStep(step, artifactSource) {
  expectIncludes(
    desktopReleaseWorkflowPath,
    step,
    "pnpm run stage-runtime-sidecar",
    "desktop release workflow must stage Runtime through the sidecar manifest stager"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    step,
    `--runtime-artifact-source ${artifactSource}`,
    `Runtime staging workflow step must use ${artifactSource} artifact source`
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    step,
    "GH_TOKEN: ${{ secrets.GH_TOKEN }}",
    "Runtime release manifest staging must have GH_TOKEN for GitHub-hosted manifest evidence"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    step,
    /--runtime-release-json|--release-json/,
    "desktop release workflow must not stage Runtime from release-body JSON"
  );
}

function checkPublisherScripts() {
  for (const [relativePath, content, label] of [
    [webPublisherPath, webPublisher, "web"],
    [desktopPublisherPath, desktopPublisher, "desktop"]
  ]) {
    expectIncludes(
      relativePath,
      content,
      "require_github_actions_publish_context",
      `${label} publisher must gate real uploads to GitHub Actions`
    );
    expectIncludes(
      relativePath,
      content,
      'GITHUB_EVENT_NAME:-}" != "workflow_dispatch"',
      `${label} publisher must only allow workflow_dispatch release uploads`
    );
    expectIncludes(
      relativePath,
      content,
      '"storage": "dsub-s3"',
      `${label} publisher index must identify DSUB S3 as the artifact store`
    );
    expectIncludes(
      relativePath,
      content,
      'upload_object "${index_path}"',
      `${label} publisher must upload compact index metadata through DSUB S3/CDN`
    );
  }

  for (const requiredUpload of [
    'upload_object "${web_asset_path}"',
    'upload_object "${web_checksum_path}"',
    'upload_object "${desktop_manifest_path}"',
    'upload_object "${desktop_manifest_checksum_path}"',
    'upload_object "${combined_checksum_path}"'
  ]) {
    expectIncludes(
      webPublisherPath,
      webPublisher,
      requiredUpload,
      "web bundle, desktop manifest metadata, and checksums must publish through the web DSUB S3 publisher"
    );
  }

  for (const requiredUpload of ['upload_object "${asset_path}"', 'upload_object "${checksum_path}"']) {
    expectIncludes(
      desktopPublisherPath,
      desktopPublisher,
      requiredUpload,
      "desktop installers and checksums must publish through the desktop DSUB S3 publisher"
    );
  }
  expectIncludes(
    desktopPublisherPath,
    desktopPublisher,
    "package-id=${package_id}",
    "desktop publisher S3 metadata must use the user-facing package id instead of public Rust triple names"
  );
  rejectPattern(
    desktopPublisherPath,
    desktopPublisher,
    /desktop\/\$\{target\}|desktop-\$\{target\}|skenion-studio-\$\{target\}/,
    "desktop publisher public paths and asset names must not expose internal Rust target triples"
  );
}

function checkDesktopPackaging() {
  rejectPattern(
    packageDesktopPath,
    packageDesktop,
    /archiveExtension|writeZipArchive|validateZipArchive|validateTarGzArchive|\btar\b.*-czf|\.zip["'`]|\.tar\.gz["'`]/,
    "desktop package script must copy real Tauri installers directly, not wrap them into canonical zip/tar.gz archives"
  );
  for (const packageId of [
    "macos-apple-silicon",
    "macos-intel",
    "windows-x64",
    "windows-arm64",
    "linux-x64-deb",
    "linux-x64-rpm",
    "linux-arm64-deb",
    "linux-arm64-rpm"
  ]) {
    expectIncludes(
      packageDesktopPath,
      packageDesktop,
      packageId,
      `desktop package script must expose user-facing package id ${packageId}`
    );
  }
  for (const filenamePattern of [
    "skenion-studio-v${version}-${installer.filenamePlatform}${installer.extension}",
    "filenamePlatform: \"macos-apple-silicon\"",
    "filenamePlatform: \"windows-x64\"",
    "filenamePlatform: \"linux-x64\""
  ]) {
    expectIncludes(
      packageDesktopPath,
      packageDesktop,
      filenamePattern,
      "desktop package script must emit versioned user-facing installer filenames"
    );
  }
}

function checkPrepareArtifactsPolicy() {
  rejectPattern(
    prepareArtifactsPath,
    publicPrepareMetadata(prepareArtifacts),
    /skenion-studio-<target>|desktop\/<target>|<tar\.gz\|zip>|"checksum-pattern"|"github-release-asset-pattern"|github-release-asset-and-dsub-s3|releases\/download\/\$\{releaseTagValue\}\/|unknown-linux-gnu|\.(?:tar\.gz|zip)/,
    "prepare script desktop manifest must describe direct DSUB installers, not wrapper archives or GitHub Release asset evidence"
  );
  expectIncludes(
    prepareArtifactsPath,
    prepareArtifacts,
    '"installer-path-pattern": "skenion-studio/<release-tag>/desktop/<package-id>/<filename>"',
    "prepare script desktop manifest must use package-id installer paths"
  );
  expectIncludes(
    prepareArtifactsPath,
    prepareArtifacts,
    '"checksum-path-pattern": "skenion-studio/<release-tag>/desktop/<package-id>/<filename>.sha256"',
    "prepare script desktop manifest must use package-id checksum paths"
  );
  expectIncludes(
    prepareArtifactsPath,
    prepareArtifacts,
    "GitHub Release body records DSUB download and checksum links; GitHub Release assets are not artifact evidence.",
    "prepare script desktop manifest must document release body DSUB evidence"
  );
  for (const packageId of [
    "macos-apple-silicon",
    "macos-intel",
    "windows-x64",
    "linux-x64-deb",
    "linux-x64-rpm",
    "linux-arm64-deb",
    "linux-arm64-rpm"
  ]) {
    expectIncludes(
      prepareArtifactsPath,
      prepareArtifacts,
      packageId,
      `prepare script desktop manifest must expose user-facing package id ${packageId}`
    );
  }
  for (const installerName of [
    "skenion-studio-v<version>-macos-apple-silicon.dmg",
    "skenion-studio-v<version>-macos-intel.dmg",
    "skenion-studio-v<version>-windows-x64-setup.exe",
    "skenion-studio-v<version>-windows-x64.msi",
    "skenion-studio-v<version>-linux-x64.deb",
    "skenion-studio-v<version>-linux-x64.rpm",
    "skenion-studio-v<version>-windows-arm64-setup.exe",
    "skenion-studio-v<version>-windows-arm64.msi",
    "skenion-studio-v<version>-linux-arm64.deb",
    "skenion-studio-v<version>-linux-arm64.rpm"
  ]) {
    expectIncludes(
      prepareArtifactsPath,
      prepareArtifacts,
      installerName,
      `prepare script must publish expected installer name ${installerName}`
    );
  }
  expectIncludes(
    prepareArtifactsPath,
    prepareArtifacts,
    '"artifact-binary-format": "raw-binary"',
    "prepare script runtime metadata must describe raw Runtime binaries"
  );
}

function checkRuntimeSidecarPolicy() {
  rejectPattern(
    stageRuntimePath,
    stageRuntime,
    /archiveFormat|extractRuntimeArchive|extractZipArchive|safeArchiveEntryPath|inflateRawSync|\btar\b|\.tar\.gz|\.zip|Runtime downloads table archive/i,
    "Runtime sidecar staging must consume raw Runtime binaries, not archive wrappers"
  );
  expectIncludes(
    stageRuntimePath,
    stageRuntime,
    'assertEqual(artifact.binaryFormat, "raw-binary", "manifest.artifact.binaryFormat");',
    "Runtime sidecar staging must require raw-binary manifest artifacts"
  );
  expectIncludes(
    stageRuntimePath,
    stageRuntime,
    'assertEqual(artifact.executableName, executableName, "manifest.artifact.executableName");',
    "Runtime sidecar staging must validate the raw binary executable name"
  );
  expectIncludes(
    stageRuntimePath,
    stageRuntime,
    "function defaultRuntimeManifestUrl()",
    "Runtime sidecar staging must derive manifest evidence from Runtime tag and platform slug when no override is supplied"
  );
  expectIncludes(
    stageRuntimePath,
    stageRuntime,
    "release-body fallback is only allowed with --mode local",
    "Runtime sidecar staging must fail closed instead of using release-body fallback in release modes"
  );
  rejectPattern(
    stageRuntimePath,
    stageRuntime,
    /if \(releaseModeNames\.has\(mode\)\)[\s\S]{0,400}runtimeArtifactFromReleaseBody/,
    "Runtime sidecar release modes must not call release-body fallback"
  );
  for (const publicRuntimeName of [
    "skenion-runtime-v<version>-macos-apple-silicon",
    "skenion-runtime-v<version>-macos-intel",
    "skenion-runtime-v<version>-windows-x64.exe",
    "skenion-runtime-v<version>-windows-arm64.exe",
    "skenion-runtime-v<version>-linux-x64",
    "skenion-runtime-v<version>-linux-arm64"
  ]) {
    expectIncludes(
      stageRuntimePath,
      stageRuntime,
      publicRuntimeName,
      `Runtime sidecar staging must know public raw binary name ${publicRuntimeName}`
    );
  }
}

function checkReleaseStatusPolicy() {
  rejectPattern(
    statusScriptPath,
    statusScript,
    /\brelease\.assets\b|\bassetNameSet\b|\bmissingAssets\b|gh release (?:view|download)|--json assets/,
    "release status must not inspect GitHub Release assets for artifact completeness"
  );
  rejectPattern(
    statusScriptPath,
    statusScript,
    /unknown-linux-gnu|apple-darwin|pc-windows-msvc|skenion-studio-desktop-\$\{target\}/,
    "release status public links must use user-facing package names, not Rust target triples"
  );
  rejectPattern(
    statusScriptPath,
    statusScript,
    /unsigned-preview[\s\S]{0,120}(?:blocked|blocker|not release-complete|release completion remains blocked)|(?:blocked|blocker|not release-complete)[\s\S]{0,120}unsigned-preview/,
    "unsigned-preview may be recorded but must not make the Studio release incomplete"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    "GitHub Release assets are not used as artifact evidence",
    "release status text must state that GitHub Release assets are not artifact evidence"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    'if (mode === "desktop-artifacts-published")',
    "desktop release status update must have a dedicated publish-mode evidence gate"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    "await verifyRequiredWebArtifactEvidence();",
    "desktop release completion must verify web artifact evidence before patching the GitHub Release"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    "skenion-studio-web-artifacts-v${version}.index.json",
    "web artifact evidence check must include the DSUB web artifact index"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    'fetch(url,',
    "web artifact evidence check must use deterministic DSUB public URL existence checks"
  );
  for (const packageId of ["macos-apple-silicon", "macos-intel", "windows-x64", "linux-x64-deb", "linux-x64-rpm"]) {
    expectIncludes(
      statusScriptPath,
      statusScript,
      packageId,
      `release status must list release-blocking desktop package ${packageId}`
    );
  }
}

function checkDocsPolicy() {
  for (const [relativePath, content] of [
    [desktopReadmePath, desktopReadme],
    [ciPolicyPath, ciPolicy]
  ]) {
    rejectPattern(
      relativePath,
      content,
      /canonical DSUB (?:S3 )?release archives|skenion-studio-<target>|\.tar\.gz`? for macOS\/Linux|\.zip`? for Windows|GitHub Release carries only compact per-target desktop package index JSON assets|Runtime tarball|Runtime archive|Windows `zip` archives|tarball size/,
      "desktop release docs must describe direct installer distribution, not wrapper archives or GitHub index assets"
    );
  }
  expectIncludes(
    desktopReadmePath,
    desktopReadme,
    "real Tauri installer artifacts",
    "desktop README must document direct installer artifacts"
  );
  expectIncludes(
    webReadmePath,
    webReadme,
    "GitHub Release body records the DSUB links",
    "web README must document release body DSUB links instead of GitHub index assets"
  );
  expectIncludes(
    ciPolicyPath,
    ciPolicy,
    "GitHub Release body records DSUB download and checksum links",
    "CI policy must document DSUB links in the release body"
  );
}

function publicPrepareMetadata(content) {
  return [
    stringLiteralInitializer(content, "name"),
    stringLiteralInitializer(content, '"installer-path-pattern"'),
    stringLiteralInitializer(content, '"checksum-path-pattern"'),
    stringLiteralInitializer(content, '"release-body-evidence"'),
    stringLiteralInitializer(content, '"artifact-filename"')
  ].join("\n");
}

function stringLiteralInitializer(content, key) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.includes(`${key}:`) || line.includes(`${key}"`))
    .join("\n");
}

function readRequired(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    fail(relativePath, 1, `required policy file cannot be read: ${error.message}`);
    return "";
  }
}

function shellCommandLines(content) {
  return content.split(/\r?\n/).map((text, index) => ({
    line: index + 1,
    text: text.trim()
  }));
}

function requireStep(relativePath, content, stepName) {
  const step = splitSteps(content).find((candidate) =>
    new RegExp(`\\bname:\\s*${escapeRegExp(stepName)}\\s*$`, "m").test(candidate.text)
  );
  if (!step) {
    fail(relativePath, 1, `missing workflow step: ${stepName}`);
    return "";
  }
  return step.text;
}

function splitSteps(content) {
  const lines = content.split(/\r?\n/);
  const steps = [];
  let currentStep = undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^ {6}- (?:id|name|uses):/.test(line)) {
      if (currentStep) {
        currentStep.endLine = index;
        currentStep.text = currentStep.lines.join("\n");
        steps.push(currentStep);
      }
      currentStep = {
        startLine: index + 1,
        endLine: index + 1,
        lines: [line],
        text: line
      };
      continue;
    }

    if (currentStep) {
      currentStep.lines.push(line);
    }
  }

  if (currentStep) {
    currentStep.endLine = lines.length;
    currentStep.text = currentStep.lines.join("\n");
    steps.push(currentStep);
  }

  return steps;
}

function expectIncludes(relativePath, content, needle, message) {
  if (!content.includes(needle)) {
    fail(relativePath, 1, message);
  }
}

function rejectPattern(relativePath, content, pattern, message) {
  const match = pattern.exec(content);
  if (match) {
    fail(relativePath, lineForIndex(content, match.index), message);
  }
}

function lineForIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(relativePath, lineNumber, message) {
  failures.push(`${relativePath}:${lineNumber}: ${message}`);
}
