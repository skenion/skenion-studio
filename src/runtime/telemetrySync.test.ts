import { describe, expect, it } from "vitest";
import {
  formatFps,
  formatFrameMs,
  formatUptimeMs,
  hasTelemetryRenderError,
  telemetryPreviewBadgeColor
} from "./telemetrySync";
import type { RuntimePreviewState, RuntimeTelemetrySnapshot } from "./types";

describe("runtime telemetry sync", () => {
  it("maps preview badge colors", () => {
    expect(telemetryPreviewBadgeColor(null)).toBe("gray");

    const states: Array<[RuntimePreviewState, string]> = [
      ["running", "green"],
      ["starting", "blue"],
      ["error", "red"],
      ["exited", "orange"],
      ["stopped", "gray"]
    ];

    for (const [state, color] of states) {
      expect(telemetryPreviewBadgeColor(telemetry({ preview: { state } }))).toBe(color);
      expect(telemetryPreviewBadgeColor(telemetry({ preview: { state, stale: true } }))).toBe("yellow");
    }
  });

  it("formats fps, frame duration, and uptime", () => {
    expect(formatFps(59.83)).toBe("59.8 fps");
    expect(formatFps(null)).toBe("n/a");
    expect(formatFrameMs(16.66)).toBe("16.7 ms");
    expect(formatFrameMs(null)).toBe("n/a");
    expect(formatUptimeMs(999)).toBe("999 ms");
    expect(formatUptimeMs(1250)).toBe("1.3 s");
  });

  it("detects render errors", () => {
    expect(hasTelemetryRenderError(null)).toBe(false);
    expect(hasTelemetryRenderError(telemetry())).toBe(false);
    expect(hasTelemetryRenderError(telemetry({ render: { lastError: "surface lost" } }))).toBe(true);
  });
});

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
      framesRendered: 10,
      approxFps: 59.8,
      lastFrameMs: 16.7,
      lastError: null,
      sourceNodeId: "clear_1",
      ...overrides.render
    },
    process: {
      runtimeVersion: "0.11.0",
      uptimeMs: 1200
    },
    diagnostics: []
  };
}
