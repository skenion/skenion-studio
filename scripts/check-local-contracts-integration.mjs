#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = path.resolve(import.meta.dirname, "..");
const packageName = "@skenion/contracts";
const packageParts = packageName.split("/");
const releaseModeNames = new Set(["release", "publish", "verify", "production"]);

main().catch((error) => {
  console.error(`Local Contracts integration failed: ${error.message}`);
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (isReleaseMode()) {
    fail(
      "Local Contracts integration is not allowed in release mode. Release, publish, and verify jobs must consume the committed registry dependency."
    );
  }

  const localPackagePath = await resolveLocalPackagePath(options.contractsPackage);
  const localPackageJsonPath = path.join(localPackagePath, "package.json");
  const localPackageJson = await readJson(localPackageJsonPath, "local Contracts package.json");

  if (localPackageJson.name !== packageName) {
    fail(`Local package at ${localPackageJsonPath} is ${JSON.stringify(localPackageJson.name)}, expected ${packageName}.`);
  }

  const localVersion = requireString(localPackageJson.version, `${localPackageJsonPath} version`);
  const localMain = localPackageJson.main ?? "./dist/index.js";
  const localMainPath = path.resolve(localPackagePath, localMain);
  await assertFile(localMainPath, `local Contracts main entry ${localMain}`);
  await assertFile(path.join(localPackagePath, "dist", "index.js"), "local Contracts dist/index.js");

  const studioPackageJson = await readJson(path.join(rootDir, "package.json"), "Studio package.json");
  const declaredDependency = studioPackageJson.dependencies?.[packageName];
  if (!declaredDependency) {
    fail(`Studio package.json must declare ${packageName} in dependencies.`);
  }
  assertVersionSatisfies(localVersion, declaredDependency, "root dependency");

  const peerPackagePaths = [
    "packages/studio-web/package.json",
    "packages/studio-desktop/package.json"
  ];
  for (const relativePath of peerPackagePaths) {
    const packageJson = await readJson(path.join(rootDir, relativePath), relativePath);
    const peerRange = packageJson.peerDependencies?.[packageName];
    if (!peerRange) {
      fail(`${relativePath} must declare ${packageName} in peerDependencies.`);
    }
    assertVersionSatisfies(localVersion, peerRange, `${relativePath} peer dependency`);
  }

  await logGitEvidence(localPackagePath);
  await withLocalContractsSymlink(localPackagePath, async (packageLink) => {
    await assertResolvedLocalPackage(packageLink, localPackagePath, localVersion);
    const commands = options.command.length > 0 ? [options.command] : [
      ["pnpm", "run", "lint"],
      ["pnpm", "run", "test"]
    ];

    for (const command of commands) {
      await run(command[0], command.slice(1));
    }
  });

  console.log(`Validated Studio against local ${packageName} ${localVersion} from ${localPackagePath}.`);
}

function parseArgs(rawArgs) {
  const parsed = {
    contractsPackage: process.env.SKENION_CONTRACTS_TS_PACKAGE ?? process.env.SKENION_CONTRACTS_PACKAGE ?? "",
    command: []
  };

  const normalizedArgs = rawArgs[0] === "--" && rawArgs[1]?.startsWith("--") ? rawArgs.slice(1) : rawArgs;

  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const arg = normalizedArgs[index];
    if (arg === "--") {
      parsed.command = normalizedArgs.slice(index + 1);
      break;
    }
    if (arg === "--contracts-package" || arg === "--contracts-package-path") {
      parsed.contractsPackage = requireOptionValue(normalizedArgs[++index], arg);
      continue;
    }
    if (arg.startsWith("--contracts-package=")) {
      parsed.contractsPackage = arg.slice("--contracts-package=".length);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(`usage: node scripts/check-local-contracts-integration.mjs [--contracts-package <path>] [-- <command...>]

Validates Studio against a local @skenion/contracts TS package without changing
committed package manifests. The package path can also be supplied through
SKENION_CONTRACTS_TS_PACKAGE.
`);
      process.exit(0);
    }
    fail(`Unknown option ${arg}.`);
  }

  return parsed;
}

async function resolveLocalPackagePath(explicitPath) {
  const candidates = explicitPath
    ? [explicitPath]
    : [
        ".deps/skenion-contracts/packages/ts",
        ".deps/skenion-contracts/packages/typescript",
        "../Skenion-contracts/packages/ts",
        "../Skenion-contracts/packages/typescript",
        "../skenion-contracts/packages/ts",
        "../skenion-contracts/packages/typescript"
      ];

  const checked = [];
  for (const candidate of candidates) {
    const resolved = path.resolve(rootDir, candidate);
    checked.push(resolved);
    if (await fileExists(path.join(resolved, "package.json"))) {
      return resolved;
    }
  }

  fail(`Could not find local ${packageName} package.json. Checked:\n${checked.map((candidate) => `- ${candidate}`).join("\n")}`);
}

async function withLocalContractsSymlink(localPackagePath, callback) {
  const scopeDir = path.join(rootDir, "node_modules", packageParts[0]);
  const packageLink = path.join(scopeDir, packageParts[1]);
  const restorePath = `${packageLink}.registry-${process.pid}-${Date.now()}`;
  let originalMoved = false;

  await fs.mkdir(scopeDir, { recursive: true });
  if (await fileExists(packageLink)) {
    await fs.rename(packageLink, restorePath);
    originalMoved = true;
  }

  try {
    await fs.symlink(localPackagePath, packageLink, "dir");
    await callback(packageLink);
  } finally {
    await removePackageLink(packageLink);
    if (originalMoved) {
      await fs.rename(restorePath, packageLink);
    }
  }
}

async function removePackageLink(packageLink) {
  const stat = await fs.lstat(packageLink).catch(() => null);
  if (!stat) {
    return;
  }
  if (stat.isSymbolicLink()) {
    await fs.unlink(packageLink);
    return;
  }
  await fs.rm(packageLink, { force: true, recursive: true });
}

async function assertResolvedLocalPackage(packageLink, localPackagePath, localVersion) {
  const [resolvedLink, resolvedLocalPackagePath] = await Promise.all([
    fs.realpath(packageLink),
    fs.realpath(localPackagePath)
  ]);
  if (path.resolve(resolvedLink) !== path.resolve(resolvedLocalPackagePath)) {
    fail(`node_modules override resolved ${resolvedLink}, expected ${localPackagePath}.`);
  }

  const resolvedPackageJson = path.join(packageLink, "package.json");
  const pkg = await readJson(resolvedPackageJson, "resolved local Contracts package.json");
  if (pkg.version !== localVersion) {
    fail(`node_modules override resolved ${packageName} ${pkg.version}, expected ${localVersion}.`);
  }

  const script = [
    `const expectedVersion = ${JSON.stringify(localVersion)};`,
    `const pkg = await import(${JSON.stringify(packageName)});`,
    "if (pkg.skenionContractsVersion && pkg.skenionContractsVersion !== expectedVersion) {",
    "  throw new Error(`imported version ${pkg.skenionContractsVersion}, expected ${expectedVersion}`);",
    "}",
    "console.log(`Imported local @skenion/contracts ${expectedVersion}.`);"
  ].join("\n");

  await run(process.execPath, ["--input-type=module", "-e", script]);
}

async function logGitEvidence(localPackagePath) {
  const topLevel = git(["-C", localPackagePath, "rev-parse", "--show-toplevel"]);
  if (!topLevel.ok) {
    console.log(`Local Contracts package git evidence: ${localPackagePath} is not inside a git worktree.`);
    return;
  }

  const repo = topLevel.stdout.trim();
  const branch = git(["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  const commit = git(["-C", repo, "rev-parse", "HEAD"]).stdout.trim();
  const status = git(["-C", repo, "status", "--short"]).stdout.trim();
  console.log(`Local Contracts git evidence: ${repo} ${branch}@${commit}${status ? " with uncommitted changes" : " clean"}.`);
  if (status) {
    console.log(status);
  }
}

function git(argsForGit) {
  const result = spawnSync("git", argsForGit, { encoding: "utf8" });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

async function run(command, commandArgs) {
  console.log(`$ ${[command, ...commandArgs].join(" ")}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: rootDir,
      env: {
        ...process.env,
        SKENION_LOCAL_CONTRACTS_INTEGRATION: "1"
      },
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${commandArgs.join(" ")} failed with ${signal ?? `exit code ${code}`}.`));
      }
    });
  });
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

async function readJson(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    fail(`Could not read ${label} at ${filePath}: ${error.message}`);
  }
}

async function assertFile(filePath, label) {
  const stat = await fs.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    fail(`${label} is required at ${filePath}. Build the local Contracts TS package first.`);
  }
}

async function fileExists(filePath) {
  return fs.access(filePath).then(() => true, () => false);
}

function assertVersionSatisfies(version, range, label) {
  if (!satisfies(version, range)) {
    fail(`Local ${packageName} ${version} does not satisfy Studio ${label} range ${JSON.stringify(range)}.`);
  }
}

function satisfies(version, range) {
  const normalized = range.trim();
  if (normalized === version) {
    return true;
  }

  if (/^\d+\.\d+\.\d+$/.test(normalized)) {
    return normalized === version;
  }

  if (normalized.startsWith("^")) {
    const base = parseVersion(normalized.slice(1));
    const actual = parseVersion(version);
    return compareVersions(actual, base) >= 0 && actual.major === base.major;
  }

  if (normalized.startsWith("~")) {
    const base = parseVersion(normalized.slice(1));
    const actual = parseVersion(version);
    return compareVersions(actual, base) >= 0 && actual.major === base.major && actual.minor === base.minor;
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length > 0 && parts.every((part) => /^(?:>=|>|<=|<)\d+\.\d+\.\d+$/.test(part))) {
    const actual = parseVersion(version);
    return parts.every((part) => {
      const [, operator, operandText] = part.match(/^(>=|>|<=|<)(\d+\.\d+\.\d+)$/);
      const comparison = compareVersions(actual, parseVersion(operandText));
      return (
        (operator === ">=" && comparison >= 0) ||
        (operator === ">" && comparison > 0) ||
        (operator === "<=" && comparison <= 0) ||
        (operator === "<" && comparison < 0)
      );
    });
  }

  fail(`Unsupported ${packageName} range ${JSON.stringify(range)}. Use an exact version, ^, ~, or simple comparator range.`);
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    fail(`Unsupported ${packageName} version ${JSON.stringify(version)}. Expected x.y.z.`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareVersions(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireOptionValue(value, optionName) {
  if (!value || value.startsWith("--")) {
    fail(`${optionName} requires a path value.`);
  }
  return value;
}

function fail(message) {
  throw new Error(message);
}
