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
const failures = [];

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-stage-runtime-validation-"));

try {
  const artifact = await createRuntimeArchive(tempDir);
  const server = await startFixtureServer(artifact);
  try {
    await validateReleaseBodyStaging(server.origin, artifact);
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

async function expectStageFailure(label, args, expectedOutput) {
  const result = await runStage(args);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.code === 0) {
    failures.push(`${label} should fail closed but exited 0.`);
    return;
  }
  if (!output.includes(expectedOutput)) {
    failures.push(`${label} failed with unexpected output: ${output}`);
  }
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

async function startFixtureServer(artifact) {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (requestUrl.pathname === `${artifactPathPrefix}/${artifactName}`) {
      response.writeHead(200, { "content-type": "application/gzip" });
      createReadStream(artifact.archivePath).pipe(response);
      return;
    }
    if (requestUrl.pathname === `${artifactPathPrefix}/${checksumName}`) {
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
    origin: `http://127.0.0.1:${address.port}`
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

async function runStage(args) {
  return run(process.execPath, ["scripts/stage-runtime-sidecar.mjs", ...args], {
    cwd: rootDir,
    env: {
      ...process.env,
      GH_TOKEN: ""
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
