import type { GraphPatchEventV01, GraphPatchHistoryV01 } from "@skenion/contracts";

export interface RuntimeHistoryActionState {
  connected: boolean;
  sessionLoaded: boolean;
  sessionSynced: boolean;
  pendingPatchOps: number;
  history: GraphPatchHistoryV01 | null;
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
  history: GraphPatchHistoryV01 | null,
  limit: number
): GraphPatchEventV01[] {
  if (!history || limit <= 0) {
    return [];
  }

  return history.events.slice(-limit).reverse();
}

function runtimeHistoryUnavailableReason(state: RuntimeHistoryActionState): string | null {
  if (!state.connected) {
    return "Runtime disconnected";
  }
  if (!state.sessionLoaded) {
    return "No loaded runtime session";
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
