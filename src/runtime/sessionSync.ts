import type { RuntimeConnectionStatus, RuntimeSessionResponse } from "./types";

export function runtimeGraphFingerprint(graphId: string, graphRevision: string): string {
  return `${graphId}@${graphRevision}`;
}

export function runtimeSessionFingerprint(session: RuntimeSessionResponse | null): string | null {
  const graph = session?.snapshot.project?.graph;
  if (!graph) {
    return null;
  }

  return runtimeGraphFingerprint(graph.id, graph.revision);
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
  return response.ok && response.snapshot.project ? graphFingerprint : currentLoadedGraphFingerprint;
}
