import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { TelemetryPanel } from "./TelemetryPanel";
import type { RuntimeTelemetrySnapshot } from "../runtime/types";

describe("TelemetryPanel", () => {
  it("formats running preview telemetry", () => {
    const html = renderPanel(telemetry());

    expect(html).toContain("Runtime Telemetry");
    expect(html).toContain("online");
    expect(html).toContain("running");
    expect(html).toContain("59.8 fps");
    expect(html).toContain("16.7 ms");
  });

  it("shows stale preview state and render errors", () => {
    const html = renderPanel(
      telemetry({
        preview: { stale: true },
        render: { lastError: "surface lost" }
      })
    );

    expect(html).toContain("stale");
    expect(html).toContain("surface lost");
  });

  it("shows fullscreen shader render errors", () => {
    const html = renderPanel(
      telemetry({
        render: {
          renderer: "fullscreen-shader",
          lastError: "shader validation failed"
        }
      })
    );

    expect(html).toContain("fullscreen-shader");
    expect(html).toContain("shader validation failed");
  });

  it("renders unavailable state", () => {
    const html = renderPanel(null);

    expect(html).toContain("unavailable");
    expect(html).toContain("timestamp");
  });
});

function renderPanel(telemetry: RuntimeTelemetrySnapshot | null): string {
  return renderToStaticMarkup(
    createElement(MantineProvider, null, createElement(TelemetryPanel, { telemetry }))
  );
}

function telemetry(
  overrides: {
    preview?: Partial<RuntimeTelemetrySnapshot["preview"]>;
    render?: Partial<RuntimeTelemetrySnapshot["render"]>;
  } = {}
): RuntimeTelemetrySnapshot {
  return {
    schema: "skenion.runtime.telemetry",
    schemaVersion: "0.1.0",
    ok: true,
    timestamp: "unix-ms:1",
    session: {
      loaded: true,
      graphId: "clear-color-render",
      graphRevision: "1",
      sessionRevision: 1
    },
    preview: {
      state: "running",
      pid: 42,
      stale: false,
      graphId: "clear-color-render",
      graphRevision: "1",
      sessionRevision: 1,
      previewSessionRevision: 1,
      ...overrides.preview
    },
    render: {
      active: true,
      backend: "wgpu",
      renderer: "clear-color",
      framesRendered: 12,
      approxFps: 59.8,
      lastFrameMs: 16.7,
      lastError: null,
      sourceNodeId: "clear_1",
      ...overrides.render
    },
    process: {
      runtimeVersion: "0.11.0",
      uptimeMs: 1000
    },
    diagnostics: []
  };
}
