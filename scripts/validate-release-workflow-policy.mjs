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
const desktopExistingCheckPath = "scripts/check-studio-desktop-asset-s3-existing.sh";
const desktopExistingCheckValidatorPath = "scripts/validate-studio-desktop-s3-existing-check.sh";
const desktopPublisherPath = "scripts/publish-studio-desktop-asset-s3.sh";
const statusScriptPath = "scripts/update-studio-release-status.mjs";
const runtimeReleasePinPath = "release/runtime-release.json";
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
const desktopExistingCheck = readRequired(desktopExistingCheckPath);
const desktopExistingCheckValidator = readRequired(desktopExistingCheckValidatorPath);
const desktopPublisher = readRequired(desktopPublisherPath);
const statusScript = readRequired(statusScriptPath);
const runtimeReleasePin = readRequired(runtimeReleasePinPath);
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
checkWorkflowSyntaxGuards();
checkReleaseWorkflows();
checkPublisherScripts();
checkDesktopPackaging();
checkPrepareArtifactsPolicy();
checkRuntimeSidecarPolicy();
checkReleaseStatusPolicy();
checkRuntimeReleasePinPolicy();
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
  checkDesktopMatrixDisplayPolicy();
  checkDesktopS3PreflightPolicy();
  checkDesktopReleaseCachePolicy();
  checkDesktopSetupHygienePolicy();
  checkAutomaticReleaseFlowPolicy();

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
  expectIncludes(
    desktopReleaseWorkflowPath,
    runtimePublishStep,
    "steps.preflight_desktop.outputs.exists != 'true'",
    "Runtime S3 staging must be skipped when reusable Studio desktop package evidence already exists"
  );

  checkDesktopSummarySteps();

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

function checkAutomaticReleaseFlowPolicy() {
  expectIncludes(
    studioReleaseWorkflowPath,
    studioReleaseWorkflow,
    "release:\n    types: [published]",
    "Studio Release Artifacts must publish automatically when a GitHub Release is published"
  );
  expectIncludes(
    studioReleaseWorkflowPath,
    studioReleaseWorkflow,
    "github.event.release.tag_name",
    "Studio Release Artifacts must derive release-event tags from github.event.release.tag_name"
  );
  expectIncludes(
    studioReleaseWorkflowPath,
    studioReleaseWorkflow,
    "release/runtime-release.json",
    "Studio Release Artifacts must resolve the default Runtime tag from the runtime release pin"
  );
  expectIncludes(
    studioReleaseWorkflowPath,
    studioReleaseWorkflow,
    '"event_type": "studio-desktop-release-publish"',
    "Studio Release Artifacts must trigger Desktop Release with repository_dispatch after web publish"
  );
  for (const payloadField of [
    '"tag": "${RELEASE_TAG}"',
    '"runtime_tag": "${RUNTIME_TAG}"',
    '"release_mode": "publish"',
    '"desktop_signing_mode": "unsigned-preview"'
  ]) {
    expectIncludes(
      studioReleaseWorkflowPath,
      studioReleaseWorkflow,
      payloadField,
      `Studio Release Artifacts repository_dispatch payload must include ${payloadField}`
    );
  }
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "repository_dispatch:\n    types: [studio-desktop-release-publish]",
    "Desktop Release must accept the Studio web publish repository_dispatch event"
  );
  for (const payloadField of [
    "github.event.client_payload.tag",
    "github.event.client_payload.runtime_tag",
    "github.event.client_payload.release_mode",
    "github.event.client_payload.desktop_signing_mode"
  ]) {
    expectIncludes(
      desktopReleaseWorkflowPath,
      desktopReleaseWorkflow,
      payloadField,
      `Desktop Release must derive dispatch input from ${payloadField}`
    );
  }
}

function checkDesktopS3PreflightPolicy() {
  const preflightStepInfo = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Preflight existing Studio desktop package in DSUB S3"
  );
  const preflightStep = preflightStepInfo.text;
  expectIncludes(
    desktopReleaseWorkflowPath,
    preflightStep,
    `${desktopExistingCheckPath} \\`,
    "desktop release workflow must run the Studio desktop S3 existing-artifact preflight before platform setup"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    preflightStep,
    "SOURCE_COMMIT=\"$(git rev-parse HEAD)\"",
    "desktop S3 existing-artifact preflight must validate evidence against the checked-out release tag commit"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    preflightStep,
    /--require-existing/,
    "platform desktop package preflight must stay non-strict so missing DSUB evidence triggers a rebuild"
  );
  for (const requiredEnv of [
    "SKENION_RELEASE_S3_ENDPOINT: ${{ secrets.SKENION_RELEASE_S3_ENDPOINT }}",
    "SKENION_RELEASE_S3_BUCKET: ${{ secrets.SKENION_RELEASE_S3_BUCKET }}",
    "SKENION_RELEASE_PUBLIC_BASE_URL: ${{ secrets.SKENION_RELEASE_PUBLIC_BASE_URL }}",
    "RUNTIME_TAG: ${{ needs.release.outputs.runtime_tag }}",
    "DESKTOP_SIGNING_MODE: ${{ needs.release.outputs.desktop_signing_mode }}"
  ]) {
    expectIncludes(
      desktopReleaseWorkflowPath,
      preflightStep,
      requiredEnv,
      `desktop S3 existing-artifact preflight must receive ${requiredEnv}`
    );
  }

  for (const stepName of [
    "Preflight macOS signing and notarization secrets",
    "Summarize unsigned macOS preview mode",
    "Preflight Windows installer signing policy",
    "Stage Runtime binary from release manifest (publish S3)",
    "Verify release Tauri packaging inputs",
    "Build unsigned preview Tauri desktop package (macOS)",
    "Build signed Tauri desktop package (macOS)",
    "Build Tauri desktop package (non-macOS)",
    "Collect skenion studio desktop installers",
    "Publish skenion studio desktop package to DSUB S3"
  ]) {
    const step = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, stepName);
    expectIncludes(
      desktopReleaseWorkflowPath,
      step,
      "steps.preflight_desktop.outputs.exists != 'true'",
      `${stepName} must be skipped when reusable Studio desktop package evidence already exists`
    );
  }

  const summaryStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Summarize desktop package");
  expectIncludes(
    desktopReleaseWorkflowPath,
    summaryStep,
    "reused existing DSUB S3 artifact evidence",
    "desktop package summary must report when a platform reuses existing DSUB S3 evidence"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    summaryStep,
    "steps.preflight_desktop.outputs.desktop_artifact_summary",
    "desktop package summary must print reused DSUB links from the preflight output"
  );

  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "desktop-release-status:",
    "desktop release status job must remain present after platform preflight skips"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "if: needs.release.outputs.upload_release_assets == 'true'",
    "desktop release status job must still run in publish mode instead of following platform skip outputs"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "path: .release-source",
    "desktop release status job must checkout the release tag to derive source commit evidence"
  );

  const finalVerificationStepInfo = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Verify release-blocking desktop package evidence in DSUB S3"
  );
  const finalVerificationStep = finalVerificationStepInfo.text;
  const desktopStatusStepInfo = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Mark release as desktop artifact evidence"
  );
  if (finalVerificationStepInfo.endLine >= desktopStatusStepInfo.startLine) {
    fail(
      desktopReleaseWorkflowPath,
      finalVerificationStepInfo.startLine,
      "release-blocking desktop package evidence must be verified before release status mutation"
    );
  }
  expectIncludes(
    desktopReleaseWorkflowPath,
    finalVerificationStep,
    `.release-tools/${desktopExistingCheckPath} \\`,
    "desktop release status job must verify release-blocking DSUB S3 evidence through the checker script"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    finalVerificationStep,
    "--require-existing",
    "desktop release status verification must fail closed when release-blocking DSUB S3 evidence is missing"
  );
  for (const requiredTarget of [
    "aarch64-apple-darwin",
    "x86_64-apple-darwin",
    "x86_64-pc-windows-msvc",
    "x86_64-unknown-linux-gnu"
  ]) {
    expectIncludes(
      desktopReleaseWorkflowPath,
      finalVerificationStep,
      requiredTarget,
      `desktop release status verification must check release-blocking target ${requiredTarget}`
    );
  }
  for (const requiredEnv of [
    "SOURCE_COMMIT: ${{ steps.release_source.outputs.source_commit }}",
    "RUNTIME_TAG: ${{ needs.release.outputs.runtime_tag }}",
    "DESKTOP_SIGNING_MODE: ${{ needs.release.outputs.desktop_signing_mode }}",
    "SKENION_RELEASE_S3_ENDPOINT: ${{ secrets.SKENION_RELEASE_S3_ENDPOINT }}",
    "SKENION_RELEASE_S3_BUCKET: ${{ secrets.SKENION_RELEASE_S3_BUCKET }}",
    "SKENION_RELEASE_S3_ACCESS_KEY_ID: ${{ secrets.SKENION_RELEASE_S3_ACCESS_KEY_ID }}",
    "SKENION_RELEASE_S3_SECRET_ACCESS_KEY: ${{ secrets.SKENION_RELEASE_S3_SECRET_ACCESS_KEY }}",
    "SKENION_RELEASE_PUBLIC_BASE_URL: ${{ secrets.SKENION_RELEASE_PUBLIC_BASE_URL }}"
  ]) {
    expectIncludes(
      desktopReleaseWorkflowPath,
      finalVerificationStep,
      requiredEnv,
      `desktop release status verification must receive ${requiredEnv}`
    );
  }
  rejectPattern(
    desktopReleaseWorkflowPath,
    finalVerificationStep,
    /\bcurl\b|--head|method:\s*"HEAD"/,
    "desktop release status verification must use DSUB S3 evidence rather than CDN HEAD checks"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopStatusStepInfo.text,
    /preflight_desktop|publish_desktop|package_studio_desktop/,
    "desktop release status must verify recorded evidence independently of per-platform build/publish steps"
  );

  for (const requiredScriptFragment of [
    "get-object",
    "skenion.studio.desktopPackage.v1",
    "desktop checksum file sha256",
    "desktopInstaller",
    "source-commit",
    "package-id",
    "runtime.releaseTag",
    "signing.mode"
  ]) {
    expectIncludes(
      desktopExistingCheckPath,
      desktopExistingCheck,
      requiredScriptFragment,
      `desktop S3 existing-artifact checker must validate ${requiredScriptFragment}`
    );
  }
  for (const requiredValidatorFragment of [
    "existing-linux",
    "missing-linux-rpm",
    "missing-linux-rpm-strict",
    "bad-checksum",
    "require-existing",
    "exists=true",
    "missing_package_ids=linux-x64-rpm"
  ]) {
    expectIncludes(
      desktopExistingCheckValidatorPath,
      desktopExistingCheckValidator,
      requiredValidatorFragment,
      `desktop S3 existing-artifact validator must cover ${requiredValidatorFragment}`
    );
  }
  expectIncludes(
    ".github/workflows/ci.yml",
    readRequired(".github/workflows/ci.yml"),
    "scripts/validate-studio-desktop-s3-existing-check.sh",
    "CI must run the mocked Studio desktop S3 existing-artifact preflight validation"
  );
}

function checkDesktopReleaseCachePolicy() {
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "DSUB S3 immutable object evidence is the release artifact source of truth.",
    "desktop release workflow must state that Actions caches are not release artifact evidence"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "uses: actions/cache@v4",
    "desktop release workflow must use an explicit platform-scoped pnpm cache"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "key: skenion-studio-desktop-pnpm-${{ runner.os }}-${{ runner.arch }}-${{ matrix.platform_slug }}-${{ matrix.rust_target }}-${{ hashFiles('pnpm-lock.yaml') }}",
    "desktop pnpm cache key must include OS, runner arch, platform slug, Rust target, and lockfile"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "restore-keys:",
    "desktop pnpm cache must keep restore keys platform-scoped"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "prefix-key: skenion-studio-desktop-release-${{ runner.os }}-${{ runner.arch }}-${{ matrix.platform_slug }}-${{ matrix.rust_target }}",
    "desktop Rust/Tauri cache prefix must include OS, runner arch, platform slug, and Rust target"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /node-version:\s*22[\s\S]{0,80}cache:\s*pnpm/,
    "desktop release workflow must not use setup-node's generic pnpm cache for platform desktop builds"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /actions\/cache@v4[\s\S]{0,240}path:\s*(?:artifacts\/|.*src-tauri\/target\/.*bundle|.*packages\/studio-desktop)/,
    "desktop release workflow must not cache release artifacts or Tauri bundle outputs as GitHub Actions cache entries"
  );
}

function checkDesktopSetupHygienePolicy() {
  const packageAwsProbe = requireStepInfo(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Probe AWS CLI (desktop package)");
  expectIncludes(
    desktopReleaseWorkflowPath,
    packageAwsProbe.text,
    "command -v aws",
    "desktop package job must probe for an existing AWS CLI before installing"
  );
  const packagePythonSetup = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Set up Python for AWS CLI install (desktop package)"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    packagePythonSetup.text,
    "steps.aws_cli.outputs.available != 'true'",
    "desktop package job must set up Python for AWS CLI only when aws is missing"
  );
  const packageAwsInstall = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Install missing AWS CLI (desktop package)"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    packageAwsInstall.text,
    "steps.aws_cli.outputs.available != 'true'",
    "desktop package job must install AWS CLI only when aws is missing"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    packageAwsInstall.text,
    "python -m pip install awscli",
    "desktop package job must install awscli via pip when aws is missing"
  );
  if (packageAwsProbe.endLine >= packagePythonSetup.startLine || packageAwsProbe.endLine >= packageAwsInstall.startLine) {
    fail(
      desktopReleaseWorkflowPath,
      packageAwsProbe.startLine,
      "desktop package job must probe aws before setup-python or pip install"
    );
  }

  const statusAwsProbe = requireStepInfo(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Probe AWS CLI (release status)");
  expectIncludes(
    desktopReleaseWorkflowPath,
    statusAwsProbe.text,
    "command -v aws",
    "desktop release status job must probe for an existing AWS CLI before installing"
  );
  const statusPythonSetup = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Set up Python for AWS CLI install (release status)"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    statusPythonSetup.text,
    "steps.status_aws_cli.outputs.available != 'true'",
    "desktop release status job must set up Python for AWS CLI only when aws is missing"
  );
  const statusAwsInstall = requireStepInfo(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "Install missing AWS CLI (release status)"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    statusAwsInstall.text,
    "steps.status_aws_cli.outputs.available != 'true'",
    "desktop release status job must install AWS CLI only when aws is missing"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    statusAwsInstall.text,
    "python -m pip install awscli",
    "desktop release status job must install awscli via pip when aws is missing"
  );
  if (statusAwsProbe.endLine >= statusPythonSetup.startLine || statusAwsProbe.endLine >= statusAwsInstall.startLine) {
    fail(
      desktopReleaseWorkflowPath,
      statusAwsProbe.startLine,
      "desktop release status job must probe aws before setup-python or pip install"
    );
  }

  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /uses:\s*actions\/setup-python@v6[\s\S]{0,160}if:\s*needs\.release\.outputs\.upload_release_assets == 'true'\s*(?:\n|$)/,
    "desktop release workflow must not set up Python for AWS CLI before probing for an installed aws binary"
  );

  const rustTargetStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Add Rust target");
  expectIncludes(
    desktopReleaseWorkflowPath,
    rustTargetStep,
    "rustup target list --installed",
    "desktop release workflow must check installed Rust targets before adding one"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    rustTargetStep,
    "rustup target add \"${TARGET}\"",
    "desktop release workflow must still add the Rust target when it is missing"
  );
}

function checkDesktopMatrixDisplayPolicy() {
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "name: desktop package (${{ matrix.platform_slug }})",
    "desktop package job name must use the user-facing platform slug"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /^ {4}name:.*(?:matrix\.(?:target|rust_target)|unknown-linux-gnu|apple-darwin|pc-windows-msvc)/m,
    "desktop job names must not expose internal Rust target triples"
  );
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /\bmatrix\.target\b/,
    "desktop workflow matrix must use platform_slug for display and rust_target for internal build inputs"
  );
  for (const required of [
    "platform_slug: macos-apple-silicon",
    "platform_slug: macos-intel",
    "platform_slug: windows-x64",
    "platform_slug: linux-x64",
    "platform_slug: windows-arm64",
    "platform_slug: linux-arm64",
    "rust_target: aarch64-apple-darwin",
    "rust_target: x86_64-apple-darwin",
    "rust_target: x86_64-pc-windows-msvc",
    "rust_target: x86_64-unknown-linux-gnu",
    "rust_target: aarch64-pc-windows-msvc",
    "rust_target: aarch64-unknown-linux-gnu"
  ]) {
    expectIncludes(
      desktopReleaseWorkflowPath,
      desktopReleaseWorkflow,
      required,
      `desktop matrix must include ${required}`
    );
  }
}

function checkWorkflowSyntaxGuards() {
  rejectPattern(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    /^\$\{\{\s*steps\.publish_desktop\.outputs\.desktop_artifact_summary\s*}}\s*$/m,
    "desktop release heredoc content must remain inside the YAML run block indentation"
  );
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopReleaseWorkflow,
    "          ${{ steps.publish_desktop.outputs.desktop_artifact_summary }}",
    "desktop release heredoc content must be indented as run-block YAML while rendering at shell column 1"
  );
}

function checkDesktopSummarySteps() {
  const desktopPackageSummaryStep = requireStep(desktopReleaseWorkflowPath, desktopReleaseWorkflow, "Summarize desktop package");
  expectIncludes(
    desktopReleaseWorkflowPath,
    desktopPackageSummaryStep,
    'echo "- Platform/package: ${PLATFORM_PACKAGE}"',
    "desktop package summary must report user-facing platform/package information"
  );

  for (const step of splitSteps(desktopReleaseWorkflow)) {
    if (!step.text.includes("GITHUB_STEP_SUMMARY")) {
      continue;
    }

    const lines = step.text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const lineNumber = step.startLine + index;
      const text = lines[index].trim();
      if (!/^echo\b/.test(text)) {
        continue;
      }
      if (/echo\s+["']- Target:\s*\$\{TARGET\}/.test(text)) {
        fail(
          desktopReleaseWorkflowPath,
          lineNumber,
          "desktop GITHUB_STEP_SUMMARY blocks must not echo the internal Rust target"
        );
      }
      if (/unknown-linux-gnu|apple-darwin|pc-windows-msvc/.test(text)) {
        fail(
          desktopReleaseWorkflowPath,
          lineNumber,
          "desktop GITHUB_STEP_SUMMARY echo lines must not expose internal Rust target triples"
        );
      }
    }
  }
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
  for (const [relativePath, content, label, allowedEvents] of [
    [webPublisherPath, webPublisher, "web", "workflow_dispatch|release"],
    [desktopPublisherPath, desktopPublisher, "desktop", "workflow_dispatch|repository_dispatch"]
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
      `    ${allowedEvents})`,
      `${label} publisher must allow only ${allowedEvents} release uploads`
    );
    rejectPattern(
      relativePath,
      content,
      /GITHUB_EVENT_NAME:-}" != "workflow_dispatch"/,
      `${label} publisher must not be limited to manual workflow_dispatch uploads only`
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
    checkPublisherUploadObjectPolicy(relativePath, content, label);
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
  expectIncludes(
    desktopPublisherPath,
    desktopPublisher,
    'manifest_sha="${manifest_sha%$\'\\r\'}"',
    "desktop publisher must trim Windows CRLF from manifest TSV rows before checksum comparison"
  );
  rejectPattern(
    desktopPublisherPath,
    desktopPublisher,
    /desktop\/\$\{target\}|desktop-\$\{target\}|skenion-studio-\$\{target\}/,
    "desktop publisher public paths and asset names must not expose internal Rust target triples"
  );
}

function checkPublisherUploadObjectPolicy(relativePath, content, label) {
  const uploadObject = content.match(/\n\s*upload_object\(\) \{[\s\S]*?\n\s*\}/)?.[0];
  if (!uploadObject) {
    fail(relativePath, 1, `${label} publisher must define upload_object`);
    return;
  }
  expectIncludes(
    relativePath,
    uploadObject,
    "object_exists_with_reusable_metadata",
    `${label} publisher must use best-effort HeadObject metadata reuse before uploading`
  );
  expectIncludes(
    relativePath,
    content,
    "head-object",
    `${label} publisher must preserve the metadata-aware HeadObject reuse path`
  );
  expectIncludes(
    relativePath,
    content,
    "without immutable metadata and matching size",
    `${label} publisher must allow Runtime-style reuse when HeadObject succeeds with matching size but missing metadata`
  );
  expectIncludes(
    relativePath,
    content,
    "Forbidden|AccessDenied",
    `${label} publisher must continue to conditional upload when HeadObject is forbidden`
  );
  expectIncludes(
    relativePath,
    uploadObject,
    "s3api put-object",
    `${label} publisher must use put-object as the upload authority`
  );
  expectIncludes(
    relativePath,
    uploadObject,
    "--if-none-match '*'",
    `${label} publisher must use conditional put-object to avoid overwrites`
  );
  expectIncludes(
    relativePath,
    uploadObject,
    "PreconditionFailed",
    `${label} publisher must treat conditional existing-object responses as no-overwrite retries`
  );
}

function checkRuntimeReleasePinPolicy() {
  let pin;
  try {
    pin = JSON.parse(runtimeReleasePin);
  } catch (error) {
    fail(runtimeReleasePinPath, 1, `runtime release pin must be valid JSON: ${error.message}`);
    return;
  }
  if (pin.schema !== "skenion.studio.runtimeReleasePin.v1") {
    fail(runtimeReleasePinPath, 1, "runtime release pin schema must be skenion.studio.runtimeReleasePin.v1");
  }
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pin.runtimeTag ?? "")) {
    fail(runtimeReleasePinPath, 1, "runtime release pin runtimeTag must be a concrete vx.y.z Runtime release tag");
  }
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
    "function requireRuntimeExecutableName(value, filename)",
    "Runtime sidecar staging must validate the raw binary executable name against internal or public raw-binary names"
  );
  expectIncludes(
    stageRuntimePath,
    stageRuntime,
    "function runtimeManifestUrlFromReleaseBody(release, source)",
    "Runtime sidecar staging must derive manifest evidence from the Runtime release body DSUB downloads table when no override is supplied"
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
    "verifyRecordedWebArtifactEvidence(release.body ?? \"\");",
    "desktop release completion must verify recorded web artifact evidence before patching the GitHub Release"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    "skenion-studio-web-artifacts-v${version}.index.json",
    "recorded web artifact evidence check must include the DSUB web artifact index"
  );
  rejectPattern(
    statusScriptPath,
    statusScript,
    /\bfetch\(url,|method:\s*"HEAD"|required DSUB .* returned HTTP/,
    "release status must not require GitHub-hosted runners to probe public CDN URLs before recording artifact evidence"
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
  return requireStepInfo(relativePath, content, stepName).text;
}

function requireStepInfo(relativePath, content, stepName) {
  const step = splitSteps(content).find((candidate) =>
    new RegExp(`\\bname:\\s*${escapeRegExp(stepName)}\\s*$`, "m").test(candidate.text)
  );
  if (!step) {
    fail(relativePath, 1, `missing workflow step: ${stepName}`);
    return {
      startLine: 1,
      endLine: 1,
      lines: [],
      text: ""
    };
  }
  return step;
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
