import type { RuntimeHistory, RuntimeHistoryEntry } from "./types";

export interface RuntimeHistoryActionState {
  connected: boolean;
  graphLocked: boolean;
  sessionLoaded: boolean;
  sessionSynced: boolean;
  pendingPatchOps: number;
  history: RuntimeHistory | null;
}

export interface RuntimeHistoryActionAvailability {
  canUndo: boolean;
  canRedo: boolean;
  reason: string | null;
}

export function runtimeHistoryActionAvailability(
  state: RuntimeHistoryActionState
): RuntimeHistoryActionAvailability {
  const reason = runtimeHistoryUnavailableReason(state);
  return {
    canUndo: reason === null && Boolean(state.history?.canUndo),
    canRedo: reason === null && Boolean(state.history?.canRedo),
    reason
  };
}

export function latestHistoryEvents(
  history: RuntimeHistory | null,
  limit: number
): RuntimeHistoryEntry[] {
  if (!history || limit <= 0) {
    return [];
  }

  return history.entries.slice(-limit).reverse();
}

function runtimeHistoryUnavailableReason(state: RuntimeHistoryActionState): string | null {
  if (!state.connected) {
    return "Runtime disconnected";
  }
  if (!state.sessionLoaded) {
    return "No loaded runtime session";
  }
  if (state.graphLocked) {
    return "Graph locked";
  }
  if (state.pendingPatchOps > 0) {
    return "Apply or clear pending patch operations first";
  }
  if (!state.sessionSynced) {
    return "Runtime session is not synced";
  }
  if (!state.history) {
    return "Runtime history unavailable";
  }

  return null;
}
