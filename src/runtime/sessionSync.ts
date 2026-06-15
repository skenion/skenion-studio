import type { RuntimeConnectionStatus, RuntimeSessionResponse } from "./types";

export function runtimeGraphFingerprint(graphId: string, graphRevision: string): string {
  return `${graphId}@${graphRevision}`;
}

export function runtimeSessionFingerprint(session: RuntimeSessionResponse | null): string | null {
  if (!session?.loaded || !session.graphId || !session.graphRevision) {
    return null;
  }

  return runtimeGraphFingerprint(session.graphId, session.graphRevision);
}

export function runtimeSessionIsSynced(
  status: RuntimeConnectionStatus,
  session: RuntimeSessionResponse | null,
  currentGraphFingerprint: string,
  lastLoadedGraphFingerprint: string | null
): boolean {
  return (
    status === "connected" &&
    runtimeSessionFingerprint(session) === currentGraphFingerprint &&
    lastLoadedGraphFingerprint === currentGraphFingerprint
  );
}

export function nextLoadedGraphFingerprint(
  currentLoadedGraphFingerprint: string | null,
  response: RuntimeSessionResponse,
  graphFingerprint: string
): string | null {
  return response.ok && response.loaded ? graphFingerprint : currentLoadedGraphFingerprint;
}
