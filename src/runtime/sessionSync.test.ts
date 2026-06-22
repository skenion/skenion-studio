import { describe, expect, it } from "vitest";
import type { GraphDocumentV01, ProjectDocumentV01, ViewStateV01 } from "@skenion/contracts";
import {
  nextLoadedGraphFingerprint,
  runtimeGraphFingerprint,
  runtimeSessionFingerprint,
  runtimeSessionIsSynced
} from "./sessionSync";
import type { RuntimeSessionResponse } from "./types";

const graph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "graph",
  revision: "1",
  nodes: [],
  edges: []
};
const viewState: ViewStateV01 = {
  schema: "skenion.view-state",
  schemaVersion: "0.1.0",
  canvas: {
    nodes: {},
    viewport: { x: 0, y: 0, zoom: 1 }
  }
};
const project: ProjectDocumentV01 = {
  schema: "skenion.project",
  schemaVersion: "0.1.0",
  id: "graph",
  revision: "1",
  graph,
  viewState,
  patchLibrary: []
};

const loadedSession = {
  ok: true,
  snapshot: {
    sessionRevision: 1,
    viewRevision: 1,
    controlRevision: 0,
    project,
    diagnostics: [],
    plan: null
  },
  diagnostics: [],
  report: null
} satisfies RuntimeSessionResponse;

const emptySession = {
  ...loadedSession,
  snapshot: { ...loadedSession.snapshot, project: null }
} satisfies RuntimeSessionResponse;

describe("runtime session sync", () => {
  it("fingerprints loaded runtime sessions", () => {
    expect(runtimeGraphFingerprint("graph", "1")).toBe("graph@1");
    expect(runtimeSessionFingerprint(loadedSession)).toBe("graph@1");
    expect(runtimeSessionFingerprint(emptySession)).toBeNull();
  });

  it("marks graph changes as not synced", () => {
    expect(runtimeSessionIsSynced("connected", loadedSession, "graph@1", "graph@1")).toBe(true);
    expect(runtimeSessionIsSynced("connected", loadedSession, "graph@2", "graph@1")).toBe(false);
    expect(runtimeSessionIsSynced("disconnected", loadedSession, "graph@1", "graph@1")).toBe(false);
  });

  it("updates the loaded fingerprint only after successful session load", () => {
    expect(nextLoadedGraphFingerprint(null, loadedSession, "graph@1")).toBe("graph@1");
    expect(nextLoadedGraphFingerprint("graph@1", { ...loadedSession, ok: false }, "graph@2")).toBe("graph@1");
    expect(nextLoadedGraphFingerprint("graph@1", emptySession, "graph@2")).toBe("graph@1");
  });
});
