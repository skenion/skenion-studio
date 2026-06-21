import { describe, expect, it } from "vitest";
import type { RuntimeHistory, RuntimeHistoryEntry, RuntimeHistoryEntryKind } from "./types";
import { latestHistoryEvents, runtimeHistoryActionAvailability } from "./historySync";

const history = {
  schema: "skenion.runtime.history",
  schemaVersion: "0.1.0",
  canUndo: true,
  canRedo: false,
  undoDepth: 1,
  redoDepth: 0,
  entries: [
    entry("event_000001", 1, "apply"),
    entry("event_000002", 2, "undo"),
    entry("event_000003", 3, "redo")
  ]
} satisfies RuntimeHistory;

describe("runtime history sync", () => {
  it("allows runtime undo and redo only for synced loaded sessions without pending patches", () => {
    expect(
      runtimeHistoryActionAvailability({
        ...availableState(),
        connected: true,
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
        ...availableState(),
        pendingPatchOps: 1
      })
    ).toEqual({
      canUndo: false,
      canRedo: false,
      reason: "Apply or clear pending patch operations first"
    });
  });

  it("reports the first unavailable reason in runtime state order", () => {
    expect(runtimeHistoryActionAvailability({ ...availableState(), connected: false, history: null }).reason).toBe(
      "Runtime disconnected"
    );
    expect(runtimeHistoryActionAvailability({ ...availableState(), sessionLoaded: false, history: null }).reason).toBe(
      "No loaded runtime session"
    );
    expect(runtimeHistoryActionAvailability({ ...availableState(), graphLocked: true }).reason).toBe("Graph locked");
    expect(runtimeHistoryActionAvailability({ ...availableState(), pendingPatchOps: 1 }).reason).toBe(
      "Apply or clear pending patch operations first"
    );
    expect(runtimeHistoryActionAvailability({ ...availableState(), sessionSynced: false, history: null }).reason).toBe(
      "Runtime session is not synced"
    );
    expect(runtimeHistoryActionAvailability({ ...availableState(), history: null }).reason).toBe(
      "Runtime history unavailable"
    );
  });

  it("uses runtime history canUndo and canRedo flags", () => {
    expect(
      runtimeHistoryActionAvailability({
        ...availableState(),
        history: { ...history, canUndo: false, canRedo: true }
      })
    ).toMatchObject({
      canUndo: false,
      canRedo: true
    });
  });

  it("returns latest history events in reverse chronological order", () => {
    expect(latestHistoryEvents(history, 2).map((item) => item.id)).toEqual(["event_000003", "event_000002"]);
    expect(latestHistoryEvents(history, 0)).toEqual([]);
    expect(latestHistoryEvents(null, 3)).toEqual([]);
  });
});

function availableState() {
  return {
    connected: true,
    graphLocked: false,
    sessionLoaded: true,
    sessionSynced: true,
    pendingPatchOps: 0,
    history
  };
}

function entry(id: string, sequence: number, kind: RuntimeHistoryEntryKind): RuntimeHistoryEntry {
  return {
    id,
    sequence,
    kind,
    mutation: {},
    inverseMutation: {},
    createdAt: "unix-ms:0"
  };
}
