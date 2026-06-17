#!/usr/bin/env node
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const storybookDir = path.join(rootDir, "storybook-static");
const outputDir = path.join(rootDir, "artifacts", "studio-visual-gate");

const captures = [
  {
    name: "shader-uniform-sample",
    id: "graph-reactflowcanvas--shader-uniform-graph",
    waitFor: ".react-flow__edge"
  },
  {
    name: "shader-multi-uniform-sample",
    id: "graph-reactflowcanvas--shader-multi-uniform-graph",
    waitFor: ".react-flow__edge"
  },
  {
    name: "port-demo-sample",
    id: "graph-reactflowcanvas--port-demo-graph",
    waitFor: ".react-flow__edge"
  },
  {
    name: "nodecard-float-value",
    id: "node-nodecard--value-control-ports",
    waitFor: ".canvas-node"
  },
  {
    name: "nodecard-fullscreen-shader",
    id: "node-nodecard--shader-input-and-output",
    waitFor: ".canvas-node"
  },
  {
    name: "nodecard-render-output",
    id: "node-nodecard--render-output-input",
    waitFor: ".canvas-node"
  },
  {
    name: "shader-diagnostics-panel",
    id: "inspector-panels--fullscreen-shader-diagnostics",
    waitFor: ".mantine-Alert-root"
  },
  {
    name: "help-panel-value-f32",
    id: "help-nodehelp--value-f-32",
    waitFor: ".help-graph-viewer"
  },
  {
    name: "help-graph-value-bang-set",
    id: "help-helpgraphviewer--value-bang-set",
    waitFor: ".react-flow__edge"
  },
  {
    name: "invalid-connection",
    id: "graph-reactflowcanvas--invalid-connection-diagnostic",
    waitFor: ".storybook-diagnostic-card.is-error"
  },
  {
    name: "selected-edge",
    id: "graph-reactflowcanvas--selected-edge-state",
    waitFor: ".react-flow__edge.selected"
  },
  {
    name: "many-port-node",
    id: "node-nodecard--many-ports",
    waitFor: ".canvas-node"
  }
];
const expectedArtifactNames = captures.map((capture) => `${capture.name}.png`).sort();

await ensureStorybookBuild();
await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const server = await serveStatic(storybookDir);
const browser = await chromium.launch();

try {
  const page = await browser.newPage({
    viewport: {
      width: 1180,
      height: 760
    }
  });

  for (const capture of captures) {
    const url = `${server.url}/iframe.html?id=${capture.id}&viewMode=story`;
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForSelector(capture.waitFor, { timeout: 15_000 });
    await page.waitForTimeout(250);

    const outputPath = path.join(outputDir, `${capture.name}.png`);
    await page.screenshot({
      fullPage: false,
      path: outputPath
    });
    console.log(`captured ${path.relative(rootDir, outputPath)}`);
  }

  await verifyCapturedArtifacts();
} finally {
  await browser.close();
  await server.close();
}

async function ensureStorybookBuild() {
  const iframePath = path.join(storybookDir, "iframe.html");
  try {
    await fs.access(iframePath);
  } catch {
    throw new Error("storybook-static/iframe.html is missing. Run `pnpm run build-storybook` first.");
  }
}

async function serveStatic(staticRoot) {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const requestPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.resolve(staticRoot, `.${decodeURIComponent(requestPath)}`);

    if (!filePath.startsWith(staticRoot)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
      const body = await fs.readFile(finalPath);
      response.writeHead(200, {
        "content-type": contentType(finalPath)
      });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not Found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to start Storybook static server");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    })
  };
}

async function verifyCapturedArtifacts() {
  const entries = await fs.readdir(outputDir);
  const pngNames = entries.filter((entry) => entry.endsWith(".png")).sort();
  const missing = expectedArtifactNames.filter((name) => !pngNames.includes(name));
  const unexpected = pngNames.filter((name) => !expectedArtifactNames.includes(name));
  const empty = [];

  for (const name of expectedArtifactNames) {
    const stat = await fs.stat(path.join(outputDir, name));
    if (stat.size === 0) {
      empty.push(name);
    }
  }

  const problems = [
    missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
    unexpected.length > 0 ? `unexpected: ${unexpected.join(", ")}` : null,
    empty.length > 0 ? `empty: ${empty.join(", ")}` : null
  ].filter(Boolean);

  if (problems.length > 0) {
    throw new Error(`visual gate artifact verification failed (${problems.join("; ")})`);
  }

  console.log(`verified ${expectedArtifactNames.length} visual gate artifacts`);
}

function contentType(filePath) {
  switch (path.extname(filePath)) {
    case ".css":
      return "text/css";
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
