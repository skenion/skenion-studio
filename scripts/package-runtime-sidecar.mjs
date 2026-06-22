#!/usr/bin/env node
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultInputDir = path.join(rootDir, "src-tauri", "binaries");
const defaultOutputDir = path.join(rootDir, "artifacts", "runtime-sidecars");
const supportedTargets = new Set([
  "aarch64-apple-darwin",
  "x86_64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "x86_64-unknown-linux-gnu",
  "aarch64-unknown-linux-gnu"
]);

const options = parseArgs(process.argv.slice(2));
const target = requireOption(options.target, "--target");
const inputDir = path.resolve(rootDir, options.inputDir ?? defaultInputDir);
const outputDir = path.resolve(rootDir, options.outputDir ?? defaultOutputDir);

if (!supportedTargets.has(target)) {
  fail(`--target must be one of ${[...supportedTargets].join(", ")}; got '${target}'.`);
}

const isWindows = target.includes("windows");
const stagedBinaryName = `skenion-runtime-${target}${isWindows ? ".exe" : ""}`;
const packagedBinaryName = isWindows ? "skenion-runtime.exe" : "skenion-runtime";
const extension = isWindows ? "zip" : "tar.gz";
const assetName = `skenion-runtime-sidecar-${target}.${extension}`;
const assetPath = path.join(outputDir, assetName);
const checksumPath = `${assetPath}.sha256`;
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "skenion-studio-sidecar-"));

try {
  const stagedBinary = path.join(inputDir, stagedBinaryName);
  await fs.access(stagedBinary);
  await fs.mkdir(outputDir, { recursive: true });

  const packageDir = path.join(tempDir, `skenion-runtime-sidecar-${target}`);
  await fs.mkdir(packageDir, { recursive: true });
  await fs.copyFile(stagedBinary, path.join(packageDir, packagedBinaryName));
  if (!isWindows) {
    await fs.chmod(path.join(packageDir, packagedBinaryName), 0o755);
  }
  await fs.writeFile(
    path.join(packageDir, "README.txt"),
    `Skenion Runtime sidecar\nTarget: ${target}\n`,
    "utf8"
  );

  if (isWindows) {
    await run("tar", ["-a", "-cf", assetPath, "-C", tempDir, path.basename(packageDir)]);
  } else {
    await run("tar", ["-czf", assetPath, "-C", tempDir, path.basename(packageDir)]);
  }

  const checksum = await sha256(assetPath);
  await fs.writeFile(checksumPath, `${checksum}  ${assetName}\n`, "utf8");

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      `asset_name=${assetName}\nasset_path=${assetPath}\nchecksum_path=${checksumPath}\nsha256=${checksum}\n`,
      "utf8"
    );
  }

  console.log(`packaged ${path.relative(rootDir, assetPath)}`);
  console.log(`wrote ${path.relative(rootDir, checksumPath)}`);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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

async function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}.`));
      }
    });
  });
}

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}
