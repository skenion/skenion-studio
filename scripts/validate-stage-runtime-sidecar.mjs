#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = "0.47.6";
const releaseTag = `v${version}`;
const target = "x86_64-unknown-linux-gnu";
const artifactName = `skenion-runtime-v${version}-${target}.tar.gz`;
const checksumName = `${artifactName}.sha256`;
const binaryName = "skenion-runtime";
const artifactPathPrefix = `/skenion/releases/skenion-runtime/${releaseTag}/${target}`;
const s3Bucket = "skenion";
const s3Prefix = "releases";
const failures = [];

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-stage-runtime-validation-"));

try {
  const artifact = await createRuntimeArchive(tempDir);
  const server = await startFixtureServer(artifact);
  try {
    await validateReleaseBodyStaging(server.origin, artifact);
    await validateS3ReleaseBodyStaging(server, artifact);
    await validateS3MissingPublicBaseFails(server, artifact);
    await validateS3MismatchedPublicBaseFails(server, artifact);
    await validateMissingTargetFails(server.origin);
    await validateMissingChecksumUrlFails(server.origin);
    await validateShaMismatchFails(server.origin);
    await validateManifestCheckOnly(server.origin, artifact);
  } finally {
    await closeServer(server.instance);
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

console.log("Validated Runtime sidecar staging release-body and manifest compatibility.");

async function validateReleaseBodyStaging(origin, artifact) {
  const releaseJson = await writeReleaseJson(
    "happy-release-body",
    runtimeDownloadsBody({
      archiveUrl: archiveUrl(origin),
      checksumUrl: checksumUrl(origin)
    })
  );
  const outputDir = path.join(tempDir, "happy-output");
  const result = await runStage([
    "--runtime-tag",
    releaseTag,
    "--target",
    target,
    "--mode",
    "verify",
    "--runtime-release-json",
    releaseJson,
    "--output-dir",
    outputDir
  ]);

  if (result.code !== 0) {
    failures.push(`release body staging should pass; got ${result.code}: ${result.stderr || result.stdout}`);
    return;
  }

  const stagedBinary = path.join(outputDir, `skenion-runtime-${target}`);
  const staged = await fs.readFile(stagedBinary, "utf8");
  if (staged !== artifact.binaryContents) {
    failures.push("release body staging copied the wrong Runtime binary content.");
  }
}

async function validateS3ReleaseBodyStaging(server, artifact) {
  const releaseJson = await writeReleaseJson(
    "s3-release-body",
    runtimeDownloadsBody({
      archiveUrl: archiveUrl(server.origin),
      checksumUrl: checksumUrl(server.origin)
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
      target,
      "--mode",
      "verify",
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
    failures.push(`S3 release body staging should pass; got ${result.code}: ${result.stderr || result.stdout}`);
    return;
  }

  if (server.requests.archive !== requestsBefore.archive || server.requests.checksum !== requestsBefore.checksum) {
    failures.push("S3 release body staging should not download the Runtime archive or SHA-256 through public HTTP.");
  }

  const stagedBinary = path.join(outputDir, `skenion-runtime-${target}`);
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
    `s3 cp s3://${s3Bucket}/${s3Fixture.archiveKey}`,
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
      archiveUrl: archiveUrl(server.origin),
      checksumUrl: checksumUrl(server.origin)
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
      target,
      "--mode",
      "verify",
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
      archiveUrl: archiveUrl(server.origin),
      checksumUrl: checksumUrl(server.origin)
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
      target,
      "--mode",
      "verify",
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

async function validateMissingTargetFails(origin) {
  const releaseJson = await writeReleaseJson(
    "missing-target",
    runtimeDownloadsBody({
      rowTarget: "aarch64-unknown-linux-gnu",
      archiveUrl: `${origin}/skenion/releases/skenion-runtime/${releaseTag}/aarch64-unknown-linux-gnu/skenion-runtime-v${version}-aarch64-unknown-linux-gnu.tar.gz`,
      checksumUrl: `${origin}/skenion/releases/skenion-runtime/${releaseTag}/aarch64-unknown-linux-gnu/skenion-runtime-v${version}-aarch64-unknown-linux-gnu.tar.gz.sha256`
    })
  );
  await expectStageFailure(
    "missing target row",
    ["--runtime-tag", releaseTag, "--target", target, "--runtime-release-json", releaseJson],
    "missing target row"
  );
}

async function validateMissingChecksumUrlFails(origin) {
  const releaseJson = await writeReleaseJson(
    "missing-checksum-url",
    runtimeDownloadsBody({
      archiveUrl: archiveUrl(origin),
      checksumUrl: ""
    })
  );
  await expectStageFailure(
    "missing SHA-256 URL",
    ["--runtime-tag", releaseTag, "--target", target, "--runtime-release-json", releaseJson],
    "SHA-256 URL"
  );
}

async function validateShaMismatchFails(origin) {
  const releaseJson = await writeReleaseJson(
    "sha-mismatch",
    runtimeDownloadsBody({
      archiveUrl: archiveUrl(origin),
      checksumUrl: `${checksumUrl(origin)}?case=bad-sha`
    })
  );
  await expectStageFailure(
    "SHA-256 mismatch",
    ["--runtime-tag", releaseTag, "--target", target, "--runtime-release-json", releaseJson],
    "SHA-256 mismatch"
  );
}

async function validateManifestCheckOnly(origin, artifact) {
  const manifestPath = path.join(tempDir, "runtime-manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        schema: "skenion.runtime.releaseArtifact.v1",
        component: "skenion-runtime",
        runtimeVersion: version,
        releaseTag,
        target,
        tier: "release",
        sourceCommit: "6bdd062b63c7ae4fc68db0ca1ce9d8cb53e6fe5d",
        contracts: {
          version: "0.45.0",
          line: "0.45"
        },
        artifact: {
          filename: artifactName,
          sha256: artifact.sha256,
          size: artifact.size,
          publicUrl: archiveUrl(origin),
          s3: {
            bucket: "skenion",
            key: `releases/skenion-runtime/${releaseTag}/${target}/${artifactName}`
          }
        },
        checksum: {
          filename: checksumName,
          publicUrl: checksumUrl(origin),
          s3: {
            bucket: "skenion",
            key: `releases/skenion-runtime/${releaseTag}/${target}/${checksumName}`
          }
        },
        manifest: {
          filename: `${artifactName}.manifest.json`,
          publicUrl: `${origin}${artifactPathPrefix}/${artifactName}.manifest.json`,
          s3: {
            bucket: "skenion",
            key: `releases/skenion-runtime/${releaseTag}/${target}/${artifactName}.manifest.json`
          }
        }
      },
      null,
      2
    )
  );

  const result = await runStage([
    "--runtime-tag",
    releaseTag,
    "--target",
    target,
    "--manifest",
    manifestPath,
    "--check-manifest-only"
  ]);
  if (result.code !== 0) {
    failures.push(`manifest check-only compatibility should pass; got ${result.code}: ${result.stderr || result.stdout}`);
  }
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

async function createRuntimeArchive(baseDir) {
  const fixtureDir = path.join(baseDir, `skenion-runtime-v${version}-${target}`);
  const binaryContents = "#!/bin/sh\necho skenion-runtime fixture\n";
  await fs.mkdir(fixtureDir, { recursive: true });
  await fs.writeFile(path.join(fixtureDir, binaryName), binaryContents);
  await fs.chmod(path.join(fixtureDir, binaryName), 0o755);

  const archivePath = path.join(baseDir, artifactName);
  await run("tar", ["-czf", archivePath, "-C", baseDir, path.basename(fixtureDir)]);
  const archive = await fs.readFile(archivePath);
  return {
    archivePath,
    binaryContents,
    sha256: createHash("sha256").update(archive).digest("hex"),
    size: archive.length
  };
}

async function createS3Fixture(artifact) {
  const root = path.join(tempDir, "fake-s3");
  const keyPrefix = `${s3Prefix}/skenion-runtime/${releaseTag}/${target}`;
  const objectDir = path.join(root, s3Bucket, keyPrefix);
  await fs.mkdir(objectDir, { recursive: true });
  await fs.copyFile(artifact.archivePath, path.join(objectDir, artifactName));
  await fs.writeFile(path.join(objectDir, checksumName), `${artifact.sha256}  ${artifactName}\n`, "utf8");
  return {
    root,
    archiveKey: `${keyPrefix}/${artifactName}`,
    checksumKey: `${keyPrefix}/${checksumName}`
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
    archive: 0,
    checksum: 0
  };
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (requestUrl.pathname === `${artifactPathPrefix}/${artifactName}`) {
      requests.archive += 1;
      response.writeHead(200, { "content-type": "application/gzip" });
      createReadStream(artifact.archivePath).pipe(response);
      return;
    }
    if (requestUrl.pathname === `${artifactPathPrefix}/${checksumName}`) {
      requests.checksum += 1;
      const digest = requestUrl.searchParams.get("case") === "bad-sha"
        ? "0".repeat(64)
        : artifact.sha256;
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(`${digest}  ${artifactName}\n`);
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

function runtimeDownloadsBody({ rowTarget = target, archiveUrl, checksumUrl }) {
  const checksumCell = checksumUrl ? `[sha256](${checksumUrl})` : "";
  return `## [${version}](https://github.com/skenion/skenion-runtime/compare/v0.47.5...${releaseTag})

<!-- skenion-runtime-downloads:start -->
### Runtime Downloads

Runtime binary archives are served from DSUB S3. Use the SHA-256 file next to each archive to verify downloads.

| Platform | Target | Tier | Archive | SHA-256 |
| --- | --- | --- | --- | --- |
| Linux x64 | \`${rowTarget}\` | release | [tar.gz](${archiveUrl}) | ${checksumCell} |

<!-- skenion-runtime-downloads:end -->
`;
}

async function writeReleaseJson(name, body) {
  const releaseJsonPath = path.join(tempDir, `${name}.json`);
  await fs.writeFile(releaseJsonPath, JSON.stringify({ tag_name: releaseTag, body }, null, 2));
  return releaseJsonPath;
}

function archiveUrl(origin) {
  return `${origin}${artifactPathPrefix}/${artifactName}`;
}

function checksumUrl(origin) {
  return `${origin}${artifactPathPrefix}/${checksumName}`;
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
