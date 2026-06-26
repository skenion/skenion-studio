#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siblingRuntimeDir = path.resolve(rootDir, "..", "Skenion-runtime");
const runtimeBinaryName = process.platform === "win32" ? "skenion-runtime.exe" : "skenion-runtime";
const releaseModeNames = new Set(["release", "publish", "verify", "production"]);
const startupTimeoutMs = 10_000;
const healthTimeoutMs = 5_000;

main().catch((error) => {
  console.error(`Local Runtime integration failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (isReleaseMode()) {
    fail(
      "Local Runtime integration is not allowed in release mode. Release, publish, and verify jobs must consume Runtime release artifact manifest evidence."
    );
  }

  const runtimeBinary = await resolveRuntimeBinary(options);
  const localSharedUrl = options.localSharedUrl.trim();

  if (!runtimeBinary && !localSharedUrl) {
    fail(
      "Select an explicit local Runtime mode with --runtime-bin, SKENION_RUNTIME_BIN, --sibling-debug-runtime, SKENION_RUNTIME_USE_SIBLING_DEBUG=true, or --local-shared-url."
    );
  }

  if (runtimeBinary) {
    await validateRuntimeBinary(runtimeBinary);
  }

  if (localSharedUrl) {
    await checkRuntimeHealth(localSharedUrl, "local-shared Runtime URL");
  }

  console.log("Validated Studio local Runtime integration evidence.");
}

function parseArgs(rawArgs) {
  const parsed = {
    runtimeBin: process.env.SKENION_RUNTIME_BIN ?? "",
    siblingDebugRuntime: parseBooleanEnv(process.env.SKENION_RUNTIME_USE_SIBLING_DEBUG ?? "", false),
    localSharedUrl: process.env.SKENION_LOCAL_SHARED_RUNTIME_URL ?? process.env.SKENION_RUNTIME_LOCAL_SHARED_URL ?? ""
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--runtime-bin") {
      parsed.runtimeBin = requireOptionValue(rawArgs[++index], arg);
      continue;
    }
    if (arg.startsWith("--runtime-bin=")) {
      parsed.runtimeBin = arg.slice("--runtime-bin=".length);
      continue;
    }
    if (arg === "--sibling-debug-runtime" || arg === "--use-sibling-debug-runtime") {
      parsed.siblingDebugRuntime = true;
      continue;
    }
    if (arg === "--local-shared-url" || arg === "--runtime-url") {
      parsed.localSharedUrl = requireOptionValue(rawArgs[++index], arg);
      continue;
    }
    if (arg.startsWith("--local-shared-url=")) {
      parsed.localSharedUrl = arg.slice("--local-shared-url=".length);
      continue;
    }
    if (arg.startsWith("--runtime-url=")) {
      parsed.localSharedUrl = arg.slice("--runtime-url=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`usage: node scripts/check-local-runtime-integration.mjs [options]

Validates explicit local Runtime integration evidence for Studio development.
At least one mode is required:

  --runtime-bin <path>            Start this local skenion-runtime binary.
  --sibling-debug-runtime         Start ../Skenion-runtime/target/debug/skenion-runtime.
  --local-shared-url <url>        Health-check an already-running local Runtime.

Environment alternatives:

  SKENION_RUNTIME_BIN
  SKENION_RUNTIME_USE_SIBLING_DEBUG=true
  SKENION_LOCAL_SHARED_RUNTIME_URL
`);
      process.exit(0);
    }
    fail(`Unknown option ${arg}.`);
  }

  if (parsed.runtimeBin.trim() && parsed.siblingDebugRuntime) {
    fail("--runtime-bin/SKENION_RUNTIME_BIN cannot be combined with --sibling-debug-runtime.");
  }

  return parsed;
}

async function resolveRuntimeBinary(options) {
  const explicitRuntimeBin = options.runtimeBin.trim();
  if (explicitRuntimeBin) {
    return {
      path: path.resolve(rootDir, explicitRuntimeBin),
      source: "runtime-bin"
    };
  }

  if (options.siblingDebugRuntime) {
    return {
      path: path.join(siblingRuntimeDir, "target", "debug", runtimeBinaryName),
      source: "sibling-debug-runtime"
    };
  }

  return null;
}

async function validateRuntimeBinary(runtimeBinary) {
  await assertExecutableFile(runtimeBinary.path, runtimeBinary.source);
  console.log(`Runtime binary evidence: ${runtimeBinary.path}`);
  await logGitEvidence(runtimeBinary.path);
  logRuntimeVersion(runtimeBinary.path);

  const started = await startLocalManagedRuntime(runtimeBinary.path);
  try {
    await checkRuntimeHealth(started.url, "local-managed Runtime sidecar");
  } finally {
    await stopChild(started.child);
  }
}

async function startLocalManagedRuntime(runtimeBin) {
  const child = spawn(runtimeBin, ["serve", "--host", "127.0.0.1", "--port", "0", "--startup-json"], {
    cwd: rootDir,
    env: {
      ...process.env,
      SKENION_LOCAL_RUNTIME_INTEGRATION: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  try {
    const startupLine = await readStartupLine(child, () => stderr);
    let startup;
    try {
      startup = JSON.parse(startupLine.trim());
    } catch (error) {
      fail(`Runtime startup JSON could not be parsed: ${error.message}. First stdout line: ${startupLine}`);
    }

    if (startup.schema !== "skenion.runtime.sidecar.startup") {
      fail(`Runtime startup JSON schema is ${JSON.stringify(startup.schema)}, expected skenion.runtime.sidecar.startup.`);
    }
    const url = startup.endpoint?.url;
    if (typeof url !== "string" || url.trim().length === 0) {
      fail("Runtime startup JSON did not include endpoint.url.");
    }

    console.log(`Local-managed Runtime startup endpoint: ${url}`);
    return {
      child,
      url
    };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

function readStartupLine(child, stderrText) {
  child.stdout.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    const timer = setTimeout(() => {
      finish(
        reject,
        new Error(`Timed out waiting for Runtime startup JSON after ${startupTimeoutMs}ms. Stderr:\n${stderrText()}`)
      );
    }, startupTimeoutMs);

    function finish(callback, value) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.stdout.off("data", onStdout);
      child.off("error", onError);
      child.off("exit", onExit);
      callback(value);
    }

    function onStdout(chunk) {
      stdout += chunk;
      const newlineIndex = stdout.indexOf("\n");
      if (newlineIndex !== -1) {
        finish(resolve, stdout.slice(0, newlineIndex));
      }
    }

    function onError(error) {
      finish(reject, error);
    }

    function onExit(code, signal) {
      finish(
        reject,
        new Error(
          `Runtime exited before startup JSON with ${signal ?? `exit code ${code}`}. Stdout:\n${stdout}\nStderr:\n${stderrText()}`
        )
      );
    }

    child.stdout.on("data", onStdout);
    child.on("error", onError);
    child.on("exit", onExit);
  });
}

async function checkRuntimeHealth(baseUrl, label) {
  const healthUrl = runtimeUrlForPath(baseUrl, "/health");
  const response = await fetch(healthUrl, {
    headers: {
      accept: "application/json"
    },
    signal: AbortSignal.timeout(healthTimeoutMs)
  }).catch((error) => {
    fail(`${label} health check could not reach ${healthUrl}: ${error.message}`);
  });

  if (!response.ok) {
    fail(`${label} health check returned HTTP ${response.status} from ${healthUrl}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    fail(`${label} health check returned non-JSON from ${healthUrl}: ${error.message}`);
  }

  if (payload?.ok !== true) {
    fail(`${label} health check returned ${JSON.stringify(payload)}, expected { "ok": true }.`);
  }

  console.log(`${label} health check passed: ${healthUrl}`);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Process already exited.
      }
      resolve();
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function assertExecutableFile(filePath, source) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    fail(`${source} Runtime binary is required at ${filePath}. Build or select the local Runtime explicitly first.`);
  }
  const accessMode = process.platform === "win32" ? fsConstants.R_OK : fsConstants.X_OK;
  try {
    await fs.access(filePath, accessMode);
  } catch {
    fail(`${source} Runtime binary is not executable at ${filePath}.`);
  }
}

async function logGitEvidence(runtimeBin) {
  const topLevel = git(["-C", path.dirname(runtimeBin), "rev-parse", "--show-toplevel"]);
  if (!topLevel.ok) {
    console.log(`Runtime git evidence: ${runtimeBin} is not inside a git worktree.`);
    return;
  }

  const repo = topLevel.stdout.trim();
  const [repoRealpath, siblingRealpath] = await Promise.all([
    fs.realpath(repo).catch(() => repo),
    fs.realpath(siblingRuntimeDir).catch(() => siblingRuntimeDir)
  ]);
  const branch = git(["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  const commit = git(["-C", repo, "rev-parse", "HEAD"]).stdout.trim();
  const status = git(["-C", repo, "status", "--short"]).stdout.trim();
  const label = path.resolve(repoRealpath) === path.resolve(siblingRealpath) ? "Sibling Runtime" : "Runtime";

  console.log(`${label} git evidence: ${repo} ${branch}@${commit}${status ? " with uncommitted changes" : " clean"}.`);
  if (status) {
    console.log(status);
  }
}

function logRuntimeVersion(runtimeBin) {
  const version = spawnSync(runtimeBin, ["--version"], {
    encoding: "utf8",
    timeout: 5_000
  });
  if (version.status !== 0) {
    fail(`${runtimeBin} --version failed with ${version.signal ?? `exit code ${version.status}`}.`);
  }
  console.log(`Runtime binary version: ${version.stdout.trim()}`);
}

function git(argsForGit) {
  const result = spawnSync("git", argsForGit, {
    encoding: "utf8"
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function runtimeUrlForPath(baseUrl, suffix) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(trimmed)) {
    fail(`Runtime URL must be an http(s) URL; got ${JSON.stringify(baseUrl)}.`);
  }
  return `${trimmed}${suffix}`;
}

function isReleaseMode() {
  const values = [
    process.env.SKENION_RELEASE_MODE,
    process.env.RELEASE_MODE,
    process.env.NODE_ENV,
    process.env.GITHUB_EVENT_NAME === "release" ? "release" : "",
    process.env.GITHUB_REF_TYPE === "tag" ? "release" : ""
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  return values.some((value) => releaseModeNames.has(value));
}

function parseBooleanEnv(value, defaultValue) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  fail(`Boolean environment value must be true or false; got ${JSON.stringify(value)}.`);
}

function requireOptionValue(value, optionName) {
  if (!value || value.startsWith("--")) {
    fail(`${optionName} requires a value.`);
  }
  return value;
}

function fail(message) {
  throw new Error(message);
}
