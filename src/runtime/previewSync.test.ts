import { describe, expect, it } from "vitest";
import {
  canRestartPreview,
  canStartPreview,
  canStopPreview,
  previewBadgeColor,
  previewButtonVariant
} from "./previewSync";
import type { RuntimePreviewState, RuntimePreviewStatus } from "./types";

describe("runtime preview sync", () => {
  it("allows start only for connected loaded sessions without an active preview", () => {
    expect(canStartPreview({ connected: true, sessionLoaded: true, previewStatus: null })).toBe(true);
    expect(canStartPreview({ connected: false, sessionLoaded: true, previewStatus: null })).toBe(false);
    expect(canStartPreview({ connected: true, sessionLoaded: false, previewStatus: null })).toBe(false);
    expect(canStartPreview({ connected: true, sessionLoaded: true, previewStatus: previewStatus("running") })).toBe(false);
    expect(canStartPreview({ connected: true, sessionLoaded: true, previewStatus: previewStatus("starting") })).toBe(false);
    expect(canStartPreview({ connected: true, sessionLoaded: true, previewStatus: previewStatus("exited") })).toBe(true);
  });

  it("allows stop only while preview is active", () => {
    expect(canStopPreview(null)).toBe(false);
    expect(canStopPreview(previewStatus("stopped"))).toBe(false);
    expect(canStopPreview(previewStatus("exited"))).toBe(false);
    expect(canStopPreview(previewStatus("error"))).toBe(false);
    expect(canStopPreview(previewStatus("starting"))).toBe(true);
    expect(canStopPreview(previewStatus("running"))).toBe(true);
  });

  it("allows restart for connected loaded sessions regardless of preview state", () => {
    expect(canRestartPreview({ connected: true, sessionLoaded: true, previewStatus: null })).toBe(true);
    expect(canRestartPreview({ connected: false, sessionLoaded: true, previewStatus: previewStatus("running") })).toBe(false);
    expect(canRestartPreview({ connected: true, sessionLoaded: false, previewStatus: previewStatus("running") })).toBe(false);
  });

  it("maps preview badge colors and restart variant", () => {
    const states: Array<[RuntimePreviewState, string]> = [
      ["running", "green"],
      ["starting", "blue"],
      ["error", "red"],
      ["exited", "orange"],
      ["stopped", "gray"]
    ];

    for (const [state, color] of states) {
      expect(previewBadgeColor(state, false)).toBe(color);
      expect(previewBadgeColor(state, true)).toBe("yellow");
    }

    expect(previewButtonVariant(null)).toBe("light");
    expect(previewButtonVariant(previewStatus("running", true))).toBe("filled");
    expect(previewButtonVariant(previewStatus("running", false))).toBe("light");
  });
});

function previewStatus(state: RuntimePreviewState, stale = false): RuntimePreviewStatus {
  return {
    ok: true,
    state,
    pid: null,
    graphId: state === "stopped" ? null : "minimal-value",
    graphRevision: state === "stopped" ? null : "1",
    sessionRevision: state === "stopped" ? null : 1,
    previewSessionRevision: state === "stopped" ? null : 1,
    stale,
    startedAt: state === "stopped" ? null : "unix-ms:1",
    exitedAt: state === "exited" ? "unix-ms:2" : null,
    exitCode: state === "exited" ? 0 : null,
    message: null,
    diagnostics: []
  };
}
