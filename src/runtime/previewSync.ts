import type { RuntimePreviewState, RuntimePreviewStatus } from "./types";

export interface RuntimePreviewActionState {
  connected: boolean;
  sessionLoaded: boolean;
  previewStatus: RuntimePreviewStatus | null;
}

export function canStartPreview(state: RuntimePreviewActionState): boolean {
  return state.connected && state.sessionLoaded && !previewIsActive(state.previewStatus);
}

export function canStopPreview(previewStatus: RuntimePreviewStatus | null): boolean {
  return previewIsActive(previewStatus);
}

export function canRestartPreview(state: RuntimePreviewActionState): boolean {
  return state.connected && state.sessionLoaded;
}

export function previewBadgeColor(state: RuntimePreviewState, stale: boolean): string {
  if (stale) {
    return "yellow";
  }

  switch (state) {
    case "running":
      return "green";
    case "starting":
      return "blue";
    case "error":
      return "red";
    case "exited":
      return "orange";
    case "stopped":
      return "gray";
  }
}

export function previewButtonVariant(status: RuntimePreviewStatus | null): "filled" | "light" {
  return status?.stale ? "filled" : "light";
}

function previewIsActive(status: RuntimePreviewStatus | null): boolean {
  return status?.state === "running" || status?.state === "starting";
}
