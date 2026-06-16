import { describe, expect, it } from "vitest";
import type {
  GraphPatchEventV01,
  GraphPatchHistoryV01,
  GraphPatchV01
} from "@skenion/contracts";
import {
  latestHistoryEvents,
  runtimeHistoryActionAvailability
} from "./historySync";

const history = {
  schema: "skenion.graph.patch.history",
  schemaVersion: "0.1.0",
  canUndo: true,
  canRedo: false,
  undoDepth: 1,
  redoDepth: 0,
  events: [
    event("event_000001", 1, "apply"),
    event("event_000002", 2, "undo"),
    event("event_000003", 3, "redo")
  ]
} satisfies GraphPatchHistoryV01;

describe("runtime history sync", () => {
  it("allows runtime undo and redo only for synced loaded sessions without pending patches", () => {
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: true,
        pendingPatchOps: 0,
        history: { ...history, canUndo: true, canRedo: true }
      })
    ).toEqual({
      canUndo: true,
      canRedo: true,
      reason: null
    });
  });

  it("disables undo and redo while pending patch operations exist", () => {
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: true,
        pendingPatchOps: 1,
        history
      })
    ).toEqual({
      canUndo: false,
      canRedo: false,
      reason: "Apply or clear pending patch operations first"
    });
  });

  it("reports the first unavailable reason in runtime state order", () => {
    expect(
      runtimeHistoryActionAvailability({
        connected: false,
        sessionLoaded: false,
        sessionSynced: false,
        pendingPatchOps: 1,
        history: null
      }).reason
    ).toBe("Runtime disconnected");
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: false,
        sessionSynced: false,
        pendingPatchOps: 1,
        history: null
      }).reason
    ).toBe("No loaded runtime session");
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: false,
        pendingPatchOps: 1,
        history: null
      }).reason
    ).toBe("Apply or clear pending patch operations first");
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: false,
        pendingPatchOps: 0,
        history: null
      }).reason
    ).toBe("Runtime session is not synced");
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: true,
        pendingPatchOps: 0,
        history: null
      }).reason
    ).toBe("Runtime history unavailable");
  });

  it("uses runtime history canUndo and canRedo flags", () => {
    expect(
      runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: true,
        pendingPatchOps: 0,
        history: { ...history, canUndo: false, canRedo: true }
      })
    ).toMatchObject({
      canUndo: false,
      canRedo: true
    });
  });

  it("returns latest history events in reverse chronological order", () => {
    expect(latestHistoryEvents(history, 2).map((item) => item.id)).toEqual([
      "event_000003",
      "event_000002"
    ]);
    expect(latestHistoryEvents(history, 0)).toEqual([]);
    expect(latestHistoryEvents(null, 3)).toEqual([]);
  });
});

function event(id: string, sequence: number, kind: GraphPatchEventV01["kind"]): GraphPatchEventV01 {
  return {
    schema: "skenion.graph.patch.event",
    schemaVersion: "0.1.0",
    id,
    sequence,
    kind,
    revisionBefore: String(sequence),
    revisionAfter: String(sequence + 1),
    createdAt: "unix-ms:0",
    patch: patch(`patch_${sequence}`, String(sequence)),
    inversePatch: patch(`inverse_${sequence}`, String(sequence + 1))
  };
}

function patch(id: string, baseRevision: string): GraphPatchV01 {
  return {
    schema: "skenion.graph.patch",
    schemaVersion: "0.1.0",
    id,
    baseRevision,
    ops: []
  };
}
