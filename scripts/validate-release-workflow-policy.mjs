#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(rootDir, ".github", "workflows");
const failures = [];

const webWorkflowPath = ".github/workflows/studio-release-artifacts.yml";
const desktopWorkflowPath = ".github/workflows/desktop-release.yml";
const webPublisherPath = "scripts/publish-studio-asset-s3.sh";
const desktopPublisherPath = "scripts/publish-studio-desktop-asset-s3.sh";
const statusScriptPath = "scripts/update-studio-release-status.mjs";

const workflowPaths = fs
  .readdirSync(workflowDir)
  .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
  .map((fileName) => `.github/workflows/${fileName}`)
  .sort();

const webWorkflow = readRequired(webWorkflowPath);
const desktopWorkflow = readRequired(desktopWorkflowPath);
const webPublisher = readRequired(webPublisherPath);
const desktopPublisher = readRequired(desktopPublisherPath);
const statusScript = readRequired(statusScriptPath);

for (const workflowPath of workflowPaths) {
  const workflow = readRequired(workflowPath);
  checkTokenPolicy(workflowPath, workflow);
  checkNoLocalPublish(workflowPath, workflow);
  checkNoReleaseActionBypass(workflowPath, workflow);
}

checkWorkflowUploads(webWorkflowPath, webWorkflow);
checkWorkflowUploads(desktopWorkflowPath, desktopWorkflow);
checkNoDirectS3WorkflowUpload(webWorkflowPath, webWorkflow);
checkNoDirectS3WorkflowUpload(desktopWorkflowPath, desktopWorkflow);
checkWebReleaseWorkflow();
checkDesktopReleaseWorkflow();
checkPublisherScripts();
checkReleaseStatusPolicy();

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
    "release assets must not bypass the reviewed GH_TOKEN and DSUB index upload steps"
  );
}

function checkWorkflowUploads(relativePath, content) {
  const uploadCommands = collectReleaseUploadCommands(content);
  if (uploadCommands.length !== 1) {
    fail(
      relativePath,
      1,
      `release workflow must contain exactly one compact DSUB index upload to GitHub Releases; found ${uploadCommands.length}`
    );
  }
  for (const uploadCommand of uploadCommands) {
    const command = uploadCommand.command;
    if (!/\bINDEX_PATH\b/.test(command)) {
      fail(
        relativePath,
        uploadCommand.line,
        "GitHub Release upload is limited to compact DSUB index JSON via INDEX_PATH"
      );
    }
    if (/\b--clobber\b/.test(command)) {
      fail(relativePath, uploadCommand.line, "GitHub Release index upload must not use --clobber");
    }
    if (
      /\b(?:web_asset|web_checksum|desktop_manifest|checksum_path|checksum_asset|asset_dir|asset_path|package_studio_desktop|release_assets)\b/i.test(
        command
      ) ||
      /\.(?:tar\.gz|zip|dmg|msi|exe|deb|rpm|AppImage|sha256)(?:\s|"|')/i.test(command)
    ) {
      fail(
        relativePath,
        uploadCommand.line,
        "large Studio bundles, desktop packages, and checksum files must publish through DSUB S3, not GitHub Release assets"
      );
    }
    if (/skenion-runtime|runtime[-_ ]sidecar|src-tauri\/binaries|binaries\/skenion-runtime/i.test(command)) {
      fail(
        relativePath,
        uploadCommand.line,
        "Runtime sidecars must be recorded from Runtime release evidence, not uploaded by Studio release jobs"
      );
    }

    const step = findStepForLine(content, uploadCommand.line);
    if (!step) {
      fail(relativePath, uploadCommand.line, "could not associate GitHub Release upload with a workflow step");
      continue;
    }
    if (!/GH_TOKEN:\s*\$\{\{\s*secrets\.GH_TOKEN\s*\}\}/.test(step.text)) {
      fail(relativePath, step.startLine, "GitHub Release upload step must use secrets.GH_TOKEN");
    }
    if (!/\[\[\s+-z\s+"\$\{GH_TOKEN:-\}"\s*\]\]/.test(step.text)) {
      fail(relativePath, step.startLine, "GitHub Release upload step must fail closed when GH_TOKEN is missing");
    }
    for (const required of ["gh release view", "gh release download", "cmp -s"]) {
      if (!step.text.includes(required)) {
        fail(
          relativePath,
          step.startLine,
          `GitHub Release index upload step must verify existing assets before upload with ${required}`
        );
      }
    }
  }
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

function checkWebReleaseWorkflow() {
  const metadataStep = requireStep(webWorkflowPath, webWorkflow, "Generate DSUB web artifact metadata");
  expectIncludes(
    webWorkflowPath,
    metadataStep,
    `${webPublisherPath} \\`,
    "web release metadata must be generated by the Studio DSUB S3 publisher"
  );
  expectIncludes(
    webWorkflowPath,
    metadataStep,
    "--dry-run",
    "web release metadata generation must remain a secretless dry run"
  );

  const publishStep = requireStep(webWorkflowPath, webWorkflow, "Publish Studio web artifacts to DSUB S3");
  expectIncludes(
    webWorkflowPath,
    publishStep,
    `${webPublisherPath} \\`,
    "web release publish step must use the Studio DSUB S3 publisher"
  );
  expectIncludes(
    webWorkflowPath,
    publishStep,
    "--use-existing-manifest",
    "web release publish step must reuse the dry-run manifest before uploading"
  );

  const uploadStep = requireStep(webWorkflowPath, webWorkflow, "Upload DSUB web artifact index to GitHub Release");
  expectIncludes(
    webWorkflowPath,
    uploadStep,
    "INDEX_PATH: ${{ steps.publish.outputs.index_path }}",
    "web GitHub Release upload must receive only the DSUB web index path"
  );
}

function checkDesktopReleaseWorkflow() {
  const publishStep = requireStep(desktopWorkflowPath, desktopWorkflow, "Publish skenion studio desktop package to DSUB S3");
  expectIncludes(
    desktopWorkflowPath,
    publishStep,
    `${desktopPublisherPath} \\`,
    "desktop package publish step must use the Studio desktop DSUB S3 publisher"
  );

  const uploadStep = requireStep(desktopWorkflowPath, desktopWorkflow, "Upload DSUB desktop artifact index to GitHub Release");
  expectIncludes(
    desktopWorkflowPath,
    uploadStep,
    "INDEX_PATH: ${{ steps.publish_desktop.outputs.index_path }}",
    "desktop GitHub Release upload must receive only the per-target DSUB index path"
  );

  expectPattern(
    desktopWorkflowPath,
    desktopWorkflow,
    /desktop-signing-mode:[\s\S]*?default:\s*signed-required/,
    "desktop signing must default to the fail-closed signed-required mode"
  );
  expectPattern(
    desktopWorkflowPath,
    desktopWorkflow,
    /macOS release-completion status: blocked[\s\S]*?unsigned internal\/pre-alpha artifact evidence does not satisfy signed\/notarized desktop release completion/,
    "unsigned macOS preview artifacts must be explicitly marked non-release-complete"
  );
  expectPattern(
    desktopWorkflowPath,
    desktopWorkflow,
    /unsigned-preview\)[\s\S]*?release_completion="blocked"/,
    "unsigned Windows preview artifacts must be explicitly marked non-release-complete"
  );
  expectPattern(
    desktopWorkflowPath,
    desktopWorkflow,
    /signed-required\|azure-trusted-signing\)[\s\S]*?does not yet configure Tauri Windows signing[\s\S]*?exit 1/,
    "Windows signed desktop modes must fail closed until signing is wired"
  );
  expectPattern(
    desktopWorkflowPath,
    desktopWorkflow,
    /Preflight macOS signing and notarization secrets[\s\S]*?desktop_signing_mode != 'unsigned-preview'[\s\S]*?APPLE_CERTIFICATE[\s\S]*?APPLE_TEAM_ID[\s\S]*?exit 1/,
    "macOS signed desktop publish mode must fail closed when signing or notarization secrets are missing"
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
      `${label} publisher must upload the compact index through DSUB S3/CDN`
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
  expectIncludes(
    webPublisherPath,
    webPublisher,
    '"binarySource": "skenion-runtime-release-manifest"',
    "web artifact index must record Runtime as release-manifest evidence"
  );
  expectIncludes(
    webPublisherPath,
    webPublisher,
    '"bundledByStudioWebArtifacts": False',
    "web artifacts must not bundle Runtime sidecars"
  );

  for (const requiredUpload of ['upload_object "${asset_path}"', 'upload_object "${checksum_path}"']) {
    expectIncludes(
      desktopPublisherPath,
      desktopPublisher,
      requiredUpload,
      "desktop packages and checksums must publish through the desktop DSUB S3 publisher"
    );
  }
  expectIncludes(
    desktopPublisherPath,
    desktopPublisher,
    "require_env RUNTIME_TAG",
    "desktop publisher must record the exact Runtime release tag"
  );
  expectIncludes(
    desktopPublisherPath,
    desktopPublisher,
    "require_env DESKTOP_SIGNING_MODE",
    "desktop publisher must record the desktop signing mode"
  );
}

function checkReleaseStatusPolicy() {
  const expectedWebAssets = extractFunctionBody(statusScriptPath, statusScript, "expectedWebAssets");
  expectIncludes(
    statusScriptPath,
    expectedWebAssets,
    "skenion-studio-web-artifacts-v${versionValue}.index.json",
    "current web release policy must expect only the compact DSUB web index on GitHub Releases"
  );
  rejectPattern(
    statusScriptPath,
    expectedWebAssets,
    /web-bundle|desktop-manifest|sha256/,
    "large legacy web assets and checksums must not be current web release policy assets"
  );

  const expectedDesktopAssets = extractFunctionBody(statusScriptPath, statusScript, "expectedDesktopAssets");
  expectIncludes(
    statusScriptPath,
    expectedDesktopAssets,
    "skenion-studio-desktop-${target}-v${version}.index.json",
    "current desktop release policy must expect only compact per-target DSUB indexes on GitHub Releases"
  );
  rejectPattern(
    statusScriptPath,
    expectedDesktopAssets,
    /skenion-studio-\$\{target\}\.|\bsha256\b/,
    "large legacy desktop packages and checksums must not be current desktop release policy assets"
  );

  expectIncludes(
    statusScriptPath,
    statusScript,
    'const hasReleaseCompleteSigning = signingMode !== "unsigned-preview";',
    "unsigned-preview must not satisfy desktop release-complete signing evidence"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    'blockers.push("desktop-signing-mode is unsigned-preview");',
    "desktop release status must explain unsigned-preview as a release-completion blocker"
  );
  expectIncludes(
    statusScriptPath,
    statusScript,
    "large web artifacts are not GitHub Release assets",
    "release status text must preserve the compact-index-only GitHub Release policy"
  );
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

function collectReleaseUploadCommands(content) {
  const lines = content.split(/\r?\n/);
  const commands = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/\bgh\s+release\s+upload\b/.test(lines[index])) {
      continue;
    }

    const parts = [];
    let cursor = index;
    while (cursor < lines.length) {
      const line = lines[cursor].trim();
      parts.push(line.replace(/\\\s*$/, "").trim());
      if (!/\\\s*$/.test(line)) {
        break;
      }
      cursor += 1;
    }

    commands.push({
      line: index + 1,
      command: parts.join(" ")
    });
  }
  return commands;
}

function findStepForLine(content, lineNumber) {
  return splitSteps(content).find((step) => step.startLine <= lineNumber && lineNumber <= step.endLine);
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

function extractFunctionBody(relativePath, content, functionName) {
  const start = content.indexOf(`function ${functionName}(`);
  if (start === -1) {
    fail(relativePath, 1, `missing required function: ${functionName}`);
    return "";
  }

  const openBrace = content.indexOf("{", start);
  if (openBrace === -1) {
    fail(relativePath, lineForIndex(content, start), `cannot parse function body: ${functionName}`);
    return "";
  }

  let depth = 0;
  for (let index = openBrace; index < content.length; index += 1) {
    const character = content[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(openBrace + 1, index);
      }
    }
  }

  fail(relativePath, lineForIndex(content, openBrace), `unterminated function body: ${functionName}`);
  return "";
}

function expectIncludes(relativePath, content, needle, message) {
  if (!content.includes(needle)) {
    fail(relativePath, 1, message);
  }
}

function expectPattern(relativePath, content, pattern, message) {
  if (!pattern.test(content)) {
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
