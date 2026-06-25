#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = "0.47.8";
const releaseTag = `v${version}`;
const linuxFixture = runtimeFixture({
  target: "x86_64-unknown-linux-gnu",
  platformSlug: "linux-x64",
  platformLabel: "Linux x64",
  artifactName: `skenion-runtime-v${version}-linux-x64`,
  executableName: "skenion-runtime"
});
const windowsFixture = runtimeFixture({
  target: "x86_64-pc-windows-msvc",
  platformSlug: "windows-x64",
  platformLabel: "Windows x64",
  artifactName: `skenion-runtime-v${version}-windows-x64.exe`,
  executableName: "skenion-runtime.exe"
});
const s3Bucket = "skenion";
const s3Prefix = "releases";
const failures = [];

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-stage-runtime-validation-"));

try {
  const artifact = await createRuntimeBinary(tempDir, linuxFixture);
  const server = await startFixtureServer(artifact);
  try {
    await validateReleaseBodyFallbackRejected(server.origin, artifact);
    await validateManifestUrlStaging(server.origin, artifact);
    await validateLocalReleaseBodyStaging(server.origin, artifact);
    await validateLocalS3ReleaseBodyStaging(server, artifact);
    await validateS3MissingPublicBaseFails(server, artifact);
    await validateS3MismatchedPublicBaseFails(server, artifact);
    await validateMissingPlatformFails(server.origin);
    await validateAmbiguousPlatformFails(server.origin);
    await validateMissingChecksumUrlFails(server.origin);
    await validateShaMismatchFails(server.origin);
    await validateManifestCheckOnly(server.origin, artifact);
    await validateTargetTriplePublicUrlFails(server.origin, artifact);
  } finally {
    await closeServer(server.instance);
  }

  const windowsArtifact = await createRuntimeBinary(tempDir, windowsFixture);
  const windowsServer = await startFixtureServer(windowsArtifact);
  try {
    await validateManifestUrlStaging(windowsServer.origin, windowsArtifact);
    await validateLocalReleaseBodyStaging(windowsServer.origin, windowsArtifact);
    await validateManifestCheckOnly(windowsServer.origin, windowsArtifact);
  } finally {
    await closeServer(windowsServer.instance);
  }
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error("Runtime sidecar staging validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Validated Runtime sidecar manifest-required release staging compatibility.");

function runtimeFixture({ target, platformSlug, platformLabel, artifactName, executableName }) {
  const checksumName = `${artifactName}.sha256`;
  return {
    target,
    platformSlug,
    platformLabel,
    artifactName,
    checksumName,
    executableName,
    artifactPathPrefix: `/skenion/releases/skenion-runtime/${releaseTag}/${platformSlug}`
  };
}

async function validateReleaseBodyFallbackRejected(origin, artifact) {
  const releaseJson = await writeReleaseJson(
    `release-body-rejected-${artifact.fixture.platformSlug}`,
    runtimeDownloadsBody({
      fixture: artifact.fixture,
      binaryUrl: binaryUrl(origin, artifact.fixture),
      checksumUrl: checksumUrl(origin, artifact.fixture)
    })
  );
  await expectStageFailure(
    "release-body fallback in verify mode",
    [
      "--runtime-tag",
      releaseTag,
      "--target",
      artifact.fixture.target,
      "--mode",
      "verify",
      "--runtime-release-json",
      releaseJson
    ],
    "release-body fallback is only allowed with --mode local"
  );
}

async function validateManifestUrlStaging(origin, artifact) {
  const outputDir = path.join(tempDir, `manifest-url-output-${artifact.fixture.platformSlug}`);
  const result = await runStage([
    "--runtime-tag",
    releaseTag,
    "--target",
    artifact.fixture.target,
    "--mode",
    "verify",
    "--runtime-manifest-url",
    manifestUrl(origin, artifact.fixture),
    "--output-dir",
    outputDir
  ]);

  if (result.code !== 0) {
    failures.push(`manifest URL staging should pass; got ${result.code}: ${result.stderr || result.stdout}`);
    return;
  }

  const stagedBinary = path.join(
    outputDir,
    `skenion-runtime-${artifact.fixture.target}${artifact.fixture.target.includes("windows") ? ".exe" : ""}`
  );
  const staged = await fs.readFile(stagedBinary, "utf8");
  if (staged !== artifact.binaryContents) {
    failures.push(`manifest URL staging copied the wrong Runtime binary content for ${artifact.fixture.platformSlug}.`);
  }
}

async function validateLocalReleaseBodyStaging(origin, artifact) {
  const releaseJson = await writeReleaseJson(
    `local-release-body-${artifact.fixture.platformSlug}`,
    runtimeDownloadsBody({
      fixture: artifact.fixture,
      binaryUrl: binaryUrl(origin, artifact.fixture),
      checksumUrl: checksumUrl(origin, artifact.fixture)
    })
  );
  const outputDir = path.join(tempDir, "happy-output");
  const result = await runStage([
    "--runtime-tag",
    releaseTag,
    "--target",
    artifact.fixture.target,
    "--mode",
    "local",
    "--runtime-release-json",
    releaseJson,
    "--output-dir",
    outputDir
  ]);

  if (result.code !== 0) {
    failures.push(`local release body staging should pass; got ${result.code}: ${result.stderr || result.stdout}`);
    return;
  }

  const stagedBinary = path.join(
    outputDir,
    `skenion-runtime-${artifact.fixture.target}${artifact.fixture.target.includes("windows") ? ".exe" : ""}`
  );
  const staged = await fs.readFile(stagedBinary, "utf8");
  if (staged !== artifact.binaryContents) {
    failures.push(`local release body staging copied the wrong Runtime binary content for ${artifact.fixture.platformSlug}.`);
  }
}

async function validateLocalS3ReleaseBodyStaging(server, artifact) {
  const releaseJson = await writeReleaseJson(
    "s3-release-body",
    runtimeDownloadsBody({
      fixture: artifact.fixture,
      binaryUrl: binaryUrl(server.origin, artifact.fixture),
      checksumUrl: checksumUrl(server.origin, artifact.fixture)
    })
  );
  const s3Fixture = await createS3Fixture(artifact);
  const fakeAws = await createFakeAwsCli();
  const outputDir = path.join(tempDir, "s3-output");
  const requestsBefore = { ...server.requests };
  const result = await runStage(
    [
      "--runtime-tag",
      releaseTag,
      "--target",
      artifact.fixture.target,
      "--mode",
      "local",
      "--runtime-release-json",
      releaseJson,
      "--runtime-artifact-source",
      "s3",
      "--output-dir",
      outputDir
    ],
    runtimeS3Env({
      fakeAws,
      s3Fixture,
      publicBaseUrl: `${server.origin}/skenion/releases`
    })
  );

  if (result.code !== 0) {
    failures.push(`local S3 release body staging should pass; got ${result.code}: ${result.stderr || result.stdout}`);
    return;
  }

  if (server.requests.binary !== requestsBefore.binary || server.requests.checksum !== requestsBefore.checksum) {
    failures.push("S3 release body staging should not download the Runtime binary or SHA-256 through public HTTP.");
  }

  const stagedBinary = path.join(outputDir, `skenion-runtime-${artifact.fixture.target}`);
  const staged = await fs.readFile(stagedBinary, "utf8");
  if (staged !== artifact.binaryContents) {
    failures.push("S3 release body staging copied the wrong Runtime binary content.");
  }

  const awsLog = (await fs.readFile(fakeAws.logPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const copiedSources = awsLog.map((entry) => entry.args.slice(0, 4).join(" "));
  for (const expected of [
    `s3 cp s3://${s3Bucket}/${s3Fixture.binaryKey}`,
    `s3 cp s3://${s3Bucket}/${s3Fixture.checksumKey}`
  ]) {
    if (!copiedSources.some((source) => source.startsWith(expected))) {
      failures.push(`S3 release body staging did not copy expected object: ${expected}`);
    }
  }
}

async function validateS3MissingPublicBaseFails(server, artifact) {
  const releaseJson = await writeReleaseJson(
    "s3-missing-public-base",
    runtimeDownloadsBody({
      fixture: artifact.fixture,
      binaryUrl: binaryUrl(server.origin, artifact.fixture),
      checksumUrl: checksumUrl(server.origin, artifact.fixture)
    })
  );
  const s3Fixture = await createS3Fixture(artifact);
  const fakeAws = await createFakeAwsCli();
  await expectStageFailure(
    "S3 missing public base",
    [
      "--runtime-tag",
      releaseTag,
      "--target",
      artifact.fixture.target,
      "--mode",
      "local",
      "--runtime-release-json",
      releaseJson,
      "--runtime-artifact-source",
      "s3"
    ],
    "SKENION_RELEASE_PUBLIC_BASE_URL is required",
    runtimeS3Env({ fakeAws, s3Fixture })
  );
}

async function validateS3MismatchedPublicBaseFails(server, artifact) {
  const releaseJson = await writeReleaseJson(
    "s3-mismatched-public-base",
    runtimeDownloadsBody({
      fixture: artifact.fixture,
      binaryUrl: binaryUrl(server.origin, artifact.fixture),
      checksumUrl: checksumUrl(server.origin, artifact.fixture)
    })
  );
  const s3Fixture = await createS3Fixture(artifact);
  const fakeAws = await createFakeAwsCli();
  await expectStageFailure(
    "S3 mismatched public base",
    [
      "--runtime-tag",
      releaseTag,
      "--target",
      artifact.fixture.target,
      "--mode",
      "local",
      "--runtime-release-json",
      releaseJson,
      "--runtime-artifact-source",
      "s3"
    ],
    "outside SKENION_RELEASE_PUBLIC_BASE_URL path",
    runtimeS3Env({
      fakeAws,
      s3Fixture,
      publicBaseUrl: `${server.origin}/wrong/releases`
    })
  );
}

async function validateMissingPlatformFails(origin) {
  const releaseJson = await writeReleaseJson(
    "missing-platform",
    runtimeDownloadsBody({
      fixture: linuxFixture,
      rowPlatform: "Linux Arm64",
      rowSlug: "linux-arm64",
      binaryUrl: `${origin}/skenion/releases/skenion-runtime/${releaseTag}/linux-arm64/skenion-runtime-v${version}-linux-arm64`,
      checksumUrl: `${origin}/skenion/releases/skenion-runtime/${releaseTag}/linux-arm64/skenion-runtime-v${version}-linux-arm64.sha256`
    })
  );
  await expectStageFailure(
    "missing platform row",
    ["--runtime-tag", releaseTag, "--target", linuxFixture.target, "--mode", "local", "--runtime-release-json", releaseJson],
    "missing platform row"
  );
}

async function validateAmbiguousPlatformFails(origin) {
  const body = `## [${version}](https://github.com/skenion/skenion-runtime/compare/v0.47.5...${releaseTag})

<!-- skenion-runtime-downloads:start -->
### Runtime Downloads

| Platform | Slug | Tier | Binary | SHA-256 |
| --- | --- | --- | --- | --- |
| Linux x64 | \`linux-x64\` | release | [raw binary](${binaryUrl(origin, linuxFixture)}) | [sha256](${checksumUrl(origin, linuxFixture)}) |
| Linux x64 | \`linux-x64\` | release | [raw binary](${binaryUrl(origin, linuxFixture)}) | [sha256](${checksumUrl(origin, linuxFixture)}) |

<!-- skenion-runtime-downloads:end -->
`;
  const releaseJson = await writeReleaseJson("ambiguous-platform", body);
  await expectStageFailure(
    "ambiguous platform row",
    ["--runtime-tag", releaseTag, "--target", linuxFixture.target, "--mode", "local", "--runtime-release-json", releaseJson],
    "ambiguous rows"
  );
}

async function validateMissingChecksumUrlFails(origin) {
  const releaseJson = await writeReleaseJson(
    "missing-checksum-url",
    runtimeDownloadsBody({
      fixture: linuxFixture,
      binaryUrl: binaryUrl(origin, linuxFixture),
      checksumUrl: ""
    })
  );
  await expectStageFailure(
    "missing SHA-256 URL",
    ["--runtime-tag", releaseTag, "--target", linuxFixture.target, "--mode", "local", "--runtime-release-json", releaseJson],
    "SHA-256 URL"
  );
}

async function validateShaMismatchFails(origin) {
  const releaseJson = await writeReleaseJson(
    "sha-mismatch",
    runtimeDownloadsBody({
      fixture: linuxFixture,
      binaryUrl: binaryUrl(origin, linuxFixture),
      checksumUrl: `${checksumUrl(origin, linuxFixture)}?case=bad-sha`
    })
  );
  await expectStageFailure(
    "SHA-256 mismatch",
    ["--runtime-tag", releaseTag, "--target", linuxFixture.target, "--mode", "local", "--runtime-release-json", releaseJson],
    "SHA-256 mismatch"
  );
}

async function validateManifestCheckOnly(origin, artifact) {
  const manifestPath = path.join(tempDir, `runtime-manifest-${artifact.fixture.platformSlug}.json`);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(runtimeManifest(origin, artifact), null, 2)
  );

  const result = await runStage([
    "--runtime-tag",
    releaseTag,
    "--target",
    artifact.fixture.target,
    "--manifest",
    manifestPath,
    "--check-manifest-only"
  ]);
  if (result.code !== 0) {
    failures.push(`manifest check-only compatibility should pass; got ${result.code}: ${result.stderr || result.stdout}`);
  }
}

async function validateTargetTriplePublicUrlFails(origin, artifact) {
  const manifestPath = path.join(tempDir, "runtime-manifest-target-triple-url.json");
  const targetTripleArtifactName = `skenion-runtime-v${version}-${artifact.fixture.target}`;
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        schema: "skenion.runtime.releaseArtifact.v1",
        component: "skenion-runtime",
        runtimeVersion: version,
        releaseTag,
        target: artifact.fixture.target,
        rustTargetTriple: artifact.fixture.target,
        platformSlug: artifact.fixture.platformSlug,
        tier: "release",
        sourceCommit: "6bdd062b63c7ae4fc68db0ca1ce9d8cb53e6fe5d",
        contracts: {
          version: "0.45.0",
          line: "0.45"
        },
        artifact: {
          filename: artifact.fixture.artifactName,
          binaryFormat: "raw-binary",
          executableName: artifact.fixture.executableName,
          sha256: artifact.sha256,
          size: artifact.size,
          publicUrl: `${origin}/skenion/releases/skenion-runtime/${releaseTag}/${artifact.fixture.target}/${targetTripleArtifactName}`,
          s3: {
            bucket: "skenion",
            key: `releases/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}/${artifact.fixture.artifactName}`
          }
        },
        checksum: {
          filename: artifact.fixture.checksumName,
          publicUrl: checksumUrl(origin, artifact.fixture),
          s3: {
            bucket: "skenion",
            key: `releases/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}/${artifact.fixture.checksumName}`
          }
        },
        manifest: {
          filename: `${artifact.fixture.artifactName}.manifest.json`,
          publicUrl: `${origin}${artifact.fixture.artifactPathPrefix}/${artifact.fixture.artifactName}.manifest.json`,
          s3: {
            bucket: "skenion",
            key: `releases/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}/${artifact.fixture.artifactName}.manifest.json`
          }
        }
      },
      null,
      2
    )
  );
  await expectStageFailure(
    "target-triple public URL",
    ["--runtime-tag", releaseTag, "--target", artifact.fixture.target, "--manifest", manifestPath, "--check-manifest-only"],
    `/${artifact.fixture.platformSlug}/${artifact.fixture.artifactName}`
  );
}

async function expectStageFailure(label, args, expectedOutput, extraEnv = {}) {
  const result = await runStage(args, extraEnv);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.code === 0) {
    failures.push(`${label} should fail closed but exited 0.`);
    return;
  }
  if (!output.includes(expectedOutput)) {
    failures.push(`${label} failed with unexpected output: ${output}`);
  }
}

function runtimeS3Env({ fakeAws, s3Fixture, publicBaseUrl }) {
  return {
    PATH: `${fakeAws.binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    FAKE_AWS_LOG: fakeAws.logPath,
    FAKE_S3_ROOT: s3Fixture.root,
    SKENION_RELEASE_S3_ENDPOINT: "https://s3.example.test",
    SKENION_RELEASE_S3_REGION: "us-east-1",
    SKENION_RELEASE_S3_BUCKET: s3Bucket,
    SKENION_RELEASE_S3_PREFIX: s3Prefix,
    SKENION_RELEASE_S3_ACCESS_KEY_ID: "fixture-access-key",
    SKENION_RELEASE_S3_SECRET_ACCESS_KEY: "fixture-secret-key",
    SKENION_RELEASE_S3_FORCE_PATH_STYLE: "true",
    SKENION_RELEASE_PUBLIC_BASE_URL: publicBaseUrl ?? ""
  };
}

async function createRuntimeBinary(baseDir, fixture) {
  const binaryPath = path.join(baseDir, fixture.artifactName);
  const binaryContents = fixture.executableName.endsWith(".exe")
    ? "skenion-runtime windows fixture\n"
    : "#!/bin/sh\necho skenion-runtime fixture\n";
  await fs.writeFile(binaryPath, binaryContents);
  if (!fixture.executableName.endsWith(".exe")) {
    await fs.chmod(binaryPath, 0o755);
  }
  const binary = await fs.readFile(binaryPath);
  return {
    fixture,
    binaryPath,
    binaryContents,
    sha256: createHash("sha256").update(binary).digest("hex"),
    size: binary.length
  };
}

async function createS3Fixture(artifact) {
  const root = path.join(tempDir, "fake-s3");
  const keyPrefix = `${s3Prefix}/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}`;
  const objectDir = path.join(root, s3Bucket, keyPrefix);
  await fs.mkdir(objectDir, { recursive: true });
  await fs.copyFile(artifact.binaryPath, path.join(objectDir, artifact.fixture.artifactName));
  await fs.writeFile(
    path.join(objectDir, artifact.fixture.checksumName),
    `${artifact.sha256}  ${artifact.fixture.artifactName}\n`,
    "utf8"
  );
  return {
    root,
    binaryKey: `${keyPrefix}/${artifact.fixture.artifactName}`,
    checksumKey: `${keyPrefix}/${artifact.fixture.checksumName}`
  };
}

async function createFakeAwsCli() {
  const binDir = path.join(tempDir, "fake-aws-bin");
  const awsPath = path.join(binDir, "aws");
  const logPath = path.join(tempDir, "fake-aws.log");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(logPath, "", "utf8");
  await fs.writeFile(
    awsPath,
    `#!/usr/bin/env node
const { copyFileSync, appendFileSync } = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_AWS_LOG, JSON.stringify({ args }) + "\\n");

if (args[0] === "--version") {
  console.log("aws-cli/2.15.0 fixture");
  process.exit(0);
}
if (args[0] !== "s3" || args[1] !== "cp") {
  console.error("fake aws only supports s3 cp");
  process.exit(2);
}
const source = args[2];
const destination = args[3];
const match = source.match(/^s3:\\/\\/([^/]+)\\/(.+)$/);
if (!match) {
  console.error(\`fake aws expected s3 source, got \${source}\`);
  process.exit(2);
}
copyFileSync(path.join(process.env.FAKE_S3_ROOT, match[1], match[2]), destination);
`,
    "utf8"
  );
  await fs.chmod(awsPath, 0o755);
  return { binDir, logPath };
}

async function startFixtureServer(artifact) {
  const requests = {
    binary: 0,
    checksum: 0
  };
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const origin = `http://${request.headers.host}`;
    if (requestUrl.pathname === `${artifact.fixture.artifactPathPrefix}/${artifact.fixture.artifactName}`) {
      requests.binary += 1;
      response.writeHead(200, {
        "content-type": "application/octet-stream"
      });
      createReadStream(artifact.binaryPath).pipe(response);
      return;
    }
    if (requestUrl.pathname === `${artifact.fixture.artifactPathPrefix}/${artifact.fixture.checksumName}`) {
      requests.checksum += 1;
      const digest = requestUrl.searchParams.get("case") === "bad-sha"
        ? "0".repeat(64)
        : artifact.sha256;
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(`${digest}  ${artifact.fixture.artifactName}\n`);
      return;
    }
    if (requestUrl.pathname === `${artifact.fixture.artifactPathPrefix}/${artifact.fixture.artifactName}.manifest.json`) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(runtimeManifest(origin, artifact), null, 2));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("not found\n");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    instance: server,
    origin: `http://127.0.0.1:${address.port}`,
    requests
  };
}

function runtimeManifest(origin, artifact) {
  return {
    schema: "skenion.runtime.releaseArtifact.v1",
    component: "skenion-runtime",
    runtimeVersion: version,
    releaseTag,
    target: artifact.fixture.target,
    rustTargetTriple: artifact.fixture.target,
    platformSlug: artifact.fixture.platformSlug,
    tier: "release",
    sourceCommit: "6bdd062b63c7ae4fc68db0ca1ce9d8cb53e6fe5d",
    contracts: {
      version: "0.45.0",
      line: "0.45"
    },
    artifact: {
      filename: artifact.fixture.artifactName,
      binaryFormat: "raw-binary",
      executableName: artifact.fixture.executableName,
      sha256: artifact.sha256,
      size: artifact.size,
      publicUrl: binaryUrl(origin, artifact.fixture),
      s3: {
        bucket: "skenion",
        key: `releases/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}/${artifact.fixture.artifactName}`
      }
    },
    checksum: {
      filename: artifact.fixture.checksumName,
      publicUrl: checksumUrl(origin, artifact.fixture),
      s3: {
        bucket: "skenion",
        key: `releases/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}/${artifact.fixture.checksumName}`
      }
    },
    manifest: {
      filename: `${artifact.fixture.artifactName}.manifest.json`,
      publicUrl: manifestUrl(origin, artifact.fixture),
      s3: {
        bucket: "skenion",
        key: `releases/skenion-runtime/${releaseTag}/${artifact.fixture.platformSlug}/${artifact.fixture.artifactName}.manifest.json`
      }
    }
  };
}

function runtimeDownloadsBody({ fixture, rowPlatform = fixture.platformLabel, rowSlug = fixture.platformSlug, binaryUrl, checksumUrl }) {
  const checksumCell = checksumUrl ? `[sha256](${checksumUrl})` : "";
  return `## [${version}](https://github.com/skenion/skenion-runtime/compare/v0.47.5...${releaseTag})

<!-- skenion-runtime-downloads:start -->
### Runtime Downloads

Runtime raw binaries are served from DSUB S3. Use the SHA-256 file next to each binary to verify downloads.

| Platform | Slug | Tier | Binary | SHA-256 |
| --- | --- | --- | --- | --- |
| ${rowPlatform} | \`${rowSlug}\` | release | [raw binary](${binaryUrl}) | ${checksumCell} |

<!-- skenion-runtime-downloads:end -->
`;
}

async function writeReleaseJson(name, body) {
  const releaseJsonPath = path.join(tempDir, `${name}.json`);
  await fs.writeFile(releaseJsonPath, JSON.stringify({ tag_name: releaseTag, body }, null, 2));
  return releaseJsonPath;
}

function binaryUrl(origin, fixture) {
  return `${origin}${fixture.artifactPathPrefix}/${fixture.artifactName}`;
}

function manifestUrl(origin, fixture) {
  return `${origin}${fixture.artifactPathPrefix}/${fixture.artifactName}.manifest.json`;
}

function checksumUrl(origin, fixture) {
  return `${origin}${fixture.artifactPathPrefix}/${fixture.checksumName}`;
}

async function runStage(args, extraEnv = {}) {
  return run(process.execPath, ["scripts/stage-runtime-sidecar.mjs", ...args], {
    cwd: rootDir,
    env: {
      ...process.env,
      GH_TOKEN: "",
      ...extraEnv
    }
  });
}

async function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      resolve({
        code: 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: `${Buffer.concat(stderr).toString("utf8")}${error.message}`
      });
    });
    child.on("close", (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
