import { describe, expect, it } from "vitest";
import {
  nextLoadedGraphFingerprint,
  runtimeGraphFingerprint,
  runtimeSessionFingerprint,
  runtimeSessionIsSynced
} from "./sessionSync";
import type { RuntimeSessionResponse } from "./types";

const loadedSession = {
  ok: true,
  loaded: true,
  graphId: "graph",
  graphRevision: "1",
  sessionRevision: 1,
  diagnostics: [],
  plan: null,
  report: null
} satisfies RuntimeSessionResponse;

describe("runtime session sync", () => {
  it("fingerprints loaded runtime sessions", () => {
    expect(runtimeGraphFingerprint("graph", "1")).toBe("graph@1");
    expect(runtimeSessionFingerprint(loadedSession)).toBe("graph@1");
    expect(runtimeSessionFingerprint({ ...loadedSession, loaded: false })).toBeNull();
  });

  it("marks graph changes as not synced", () => {
    expect(runtimeSessionIsSynced("connected", loadedSession, "graph@1", "graph@1")).toBe(true);
    expect(runtimeSessionIsSynced("connected", loadedSession, "graph@2", "graph@1")).toBe(false);
    expect(runtimeSessionIsSynced("disconnected", loadedSession, "graph@1", "graph@1")).toBe(false);
  });

  it("updates the loaded fingerprint only after successful session load", () => {
    expect(nextLoadedGraphFingerprint(null, loadedSession, "graph@1")).toBe("graph@1");
    expect(nextLoadedGraphFingerprint("graph@1", { ...loadedSession, ok: false }, "graph@2")).toBe("graph@1");
    expect(nextLoadedGraphFingerprint("graph@1", { ...loadedSession, loaded: false }, "graph@2")).toBe("graph@1");
  });
});
