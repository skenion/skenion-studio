import {
  validateGraphDocument,
  validateGraphPatchEvent,
  validateGraphPatchHistory
} from "@skenion/contracts";
import type { GraphPatchHistoryV01 } from "@skenion/contracts";
import type {
  RuntimeApiResponse,
  RuntimeControlEventRequest,
  RuntimeControlEventResponse,
  RuntimeControlStateResponse,
  RuntimeHealth,
  RuntimeInfo,
  RuntimePatchResponse,
  RuntimePreviewStartRequest,
  RuntimePreviewStatus,
  RuntimeProjectPayload,
  RuntimeSessionPatchRequest,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "./types";

export const DEFAULT_RUNTIME_URL =
  import.meta.env.VITE_SKENION_RUNTIME_URL?.trim() || "http://127.0.0.1:3761";

type FetchLike = typeof fetch;

export interface RuntimeClient {
  getHealth: () => Promise<RuntimeHealth>;
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  validateProject: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  buildPlan: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  runProject: (project: RuntimeProjectPayload, frames: number) => Promise<RuntimeApiResponse>;
  getSession: () => Promise<RuntimeSessionResponse>;
  loadSession: (project: RuntimeProjectPayload) => Promise<RuntimeSessionResponse>;
  validateSession: () => Promise<RuntimeSessionResponse>;
  planSession: () => Promise<RuntimeSessionResponse>;
  runSession: (frames: number) => Promise<RuntimeSessionResponse>;
  applySessionPatch: (patch: RuntimeSessionPatchRequest) => Promise<RuntimePatchResponse>;
  getSessionHistory: () => Promise<GraphPatchHistoryV01>;
  undoSessionPatch: () => Promise<RuntimePatchResponse>;
  redoSessionPatch: () => Promise<RuntimePatchResponse>;
  sendControlEvent: (request: RuntimeControlEventRequest) => Promise<RuntimeControlEventResponse>;
  getControlState: () => Promise<RuntimeControlStateResponse>;
  getPreviewStatus: () => Promise<RuntimePreviewStatus>;
  startPreview: (options?: Partial<RuntimePreviewStartRequest>) => Promise<RuntimePreviewStatus>;
  stopPreview: () => Promise<RuntimePreviewStatus>;
  restartPreview: () => Promise<RuntimePreviewStatus>;
  getTelemetry: () => Promise<RuntimeTelemetrySnapshot>;
  clearSession: () => Promise<RuntimeSessionResponse>;
}

export interface RuntimeClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export class RuntimeClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeClientError";
  }
}

export function createRuntimeClient(options: RuntimeClientOptions = {}): RuntimeClient {
  const baseUrl = normalizeRuntimeUrl(options.baseUrl ?? DEFAULT_RUNTIME_URL);
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    getHealth: () => requestJson<RuntimeHealth>(fetchImpl, baseUrl, "/health", { method: "GET" }, isHealth),
    getRuntimeInfo: () =>
      requestJson<RuntimeInfo>(fetchImpl, baseUrl, "/v0/runtime/info", { method: "GET" }, isRuntimeInfo),
    validateProject: (project) => postRuntimeResponse(fetchImpl, baseUrl, "/v0/validate", project),
    buildPlan: (project) => postRuntimeResponse(fetchImpl, baseUrl, "/v0/plan", project),
    runProject: (project, frames) =>
      postRuntimeResponse(fetchImpl, baseUrl, "/v0/run", {
        ...project,
        frames
      }),
    getSession: () =>
      requestJson<RuntimeSessionResponse>(fetchImpl, baseUrl, "/v0/session", { method: "GET" }, isRuntimeSessionResponse),
    loadSession: (project) => postRuntimeSessionResponse(fetchImpl, baseUrl, "/v0/session/load", project),
    validateSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        "/v0/session/validate",
        { method: "POST" },
        isRuntimeSessionResponse
      ),
    planSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        "/v0/session/plan",
        { method: "POST" },
        isRuntimeSessionResponse
    ),
    runSession: (frames) => postRuntimeSessionResponse(fetchImpl, baseUrl, "/v0/session/run", { frames }),
    applySessionPatch: (patch) => postRuntimePatchResponse(fetchImpl, baseUrl, "/v0/session/patch", patch),
    getSessionHistory: () =>
      requestJson<GraphPatchHistoryV01>(
        fetchImpl,
        baseUrl,
        "/v0/session/history",
        { method: "GET" },
        isGraphPatchHistory
      ),
    undoSessionPatch: () =>
      requestJson<RuntimePatchResponse>(
        fetchImpl,
        baseUrl,
        "/v0/session/undo",
        { method: "POST" },
        isRuntimePatchResponse
      ),
    redoSessionPatch: () =>
      requestJson<RuntimePatchResponse>(
        fetchImpl,
        baseUrl,
        "/v0/session/redo",
        { method: "POST" },
        isRuntimePatchResponse
      ),
    sendControlEvent: (request) =>
      postRuntimeControlEventResponse(fetchImpl, baseUrl, "/v0/session/control/event", request),
    getControlState: () =>
      requestJson<RuntimeControlStateResponse>(
        fetchImpl,
        baseUrl,
        "/v0/session/control/state",
        { method: "GET" },
        isRuntimeControlStateResponse
      ),
    getPreviewStatus: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        "/v0/session/preview",
        { method: "GET" },
        isRuntimePreviewStatus
      ),
    startPreview: (options = {}) =>
      postRuntimePreviewStatus(fetchImpl, baseUrl, "/v0/session/preview/start", {
        restart: options.restart ?? false
      }),
    stopPreview: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        "/v0/session/preview/stop",
        { method: "POST" },
        isRuntimePreviewStatus
      ),
    restartPreview: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        "/v0/session/preview/restart",
        { method: "POST" },
        isRuntimePreviewStatus
      ),
    getTelemetry: () =>
      requestJson<RuntimeTelemetrySnapshot>(
        fetchImpl,
        baseUrl,
        "/v0/session/telemetry",
        { method: "GET" },
        isRuntimeTelemetrySnapshot
      ),
    clearSession: () =>
      requestJson<RuntimeSessionResponse>(fetchImpl, baseUrl, "/v0/session", { method: "DELETE" }, isRuntimeSessionResponse)
  };
}

export function normalizeRuntimeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new RuntimeClientError("Runtime URL is required.");
  }

  return trimmed.replace(/\/+$/, "");
}

async function postRuntimeResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: unknown
): Promise<RuntimeApiResponse> {
  return requestJson<RuntimeApiResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimeApiResponse
  );
}

async function postRuntimeSessionResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: unknown
): Promise<RuntimeSessionResponse> {
  return requestJson<RuntimeSessionResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimeSessionResponse
  );
}

async function postRuntimePatchResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: unknown
): Promise<RuntimePatchResponse> {
  return requestJson<RuntimePatchResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimePatchResponse
  );
}

async function postRuntimePreviewStatus(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: RuntimePreviewStartRequest
): Promise<RuntimePreviewStatus> {
  return requestJson<RuntimePreviewStatus>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimePreviewStatus
  );
}

async function postRuntimeControlEventResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: RuntimeControlEventRequest
): Promise<RuntimeControlEventResponse> {
  return requestJson<RuntimeControlEventResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimeControlEventResponse
  );
}

async function requestJson<T>(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  init: RequestInit,
  guard: (value: unknown) => value is T
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, init);
  } catch (error) {
    throw new RuntimeClientError(error instanceof Error ? error.message : "Runtime request failed.");
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new RuntimeClientError("Runtime returned a non-JSON response.");
  }

  if (!response.ok) {
    throw new RuntimeClientError(`Runtime HTTP ${response.status}.`);
  }

  if (!guard(value)) {
    throw new RuntimeClientError("Runtime returned an unsupported response shape.");
  }

  return value;
}

function isHealth(value: unknown): value is RuntimeHealth {
  return isRecord(value) && typeof value.ok === "boolean" && typeof value.service === "string" && typeof value.version === "string";
}

function isRuntimeInfo(value: unknown): value is RuntimeInfo {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.apiVersion === "string" &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === "string")
  );
}

function isRuntimeApiResponse(value: unknown): value is RuntimeApiResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.plan === null || isRecord(value.plan)) &&
    (value.report === null || isRecord(value.report))
  );
}

function isRuntimeSessionResponse(value: unknown): value is RuntimeSessionResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.loaded === "boolean" &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    typeof value.sessionRevision === "number" &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.plan === null || isRecord(value.plan)) &&
    (value.report === null || isRecord(value.report))
  );
}

function isRuntimePatchResponse(value: unknown): value is RuntimePatchResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.applied === "boolean" &&
    typeof value.conflict === "boolean" &&
    (value.graph === null || validateGraphDocument(value.graph).ok) &&
    isRuntimeSessionResponse(value.session) &&
    (value.event === null || validateGraphPatchEvent(value.event).ok) &&
    isGraphPatchHistory(value.history) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlEventResponse(value: unknown): value is RuntimeControlEventResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.emitted) &&
    value.emitted.every(isRuntimeControlEmission) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlStateResponse(value: unknown): value is RuntimeControlStateResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    isRecord(value.values) &&
    Object.values(value.values).every(isRuntimeControlValue) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlEmission(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.nodeId === "string" &&
    value.portId === "value" &&
    isRuntimeControlValue(value.value)
  );
}

function isRuntimeControlValue(value: unknown): value is RuntimeControlEventRequest["value"] {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "bang") {
    return !("value" in value);
  }
  if (value.type === "f32") {
    return typeof value.value === "number" && Number.isFinite(value.value);
  }
  if (value.type === "i32") {
    return typeof value.value === "number" && Number.isInteger(value.value);
  }
  if (value.type === "bool") {
    return typeof value.value === "boolean";
  }
  if (value.type === "rgba") {
    return (
      Array.isArray(value.value) &&
      value.value.length === 4 &&
      value.value.every((component) => typeof component === "number" && Number.isFinite(component))
    );
  }

  return false;
}

function isRuntimePreviewStatus(value: unknown): value is RuntimePreviewStatus {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    isRuntimePreviewState(value.state) &&
    (typeof value.pid === "number" || value.pid === null) &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    (typeof value.sessionRevision === "number" || value.sessionRevision === null) &&
    (typeof value.previewSessionRevision === "number" || value.previewSessionRevision === null) &&
    typeof value.stale === "boolean" &&
    (typeof value.startedAt === "string" || value.startedAt === null) &&
    (typeof value.exitedAt === "string" || value.exitedAt === null) &&
    (typeof value.exitCode === "number" || value.exitCode === null) &&
    (typeof value.message === "string" || value.message === null) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeTelemetrySnapshot(value: unknown): value is RuntimeTelemetrySnapshot {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.telemetry" &&
    value.schemaVersion === "0.1.0" &&
    typeof value.ok === "boolean" &&
    typeof value.timestamp === "string" &&
    isRuntimeTelemetrySession(value.session) &&
    isRuntimeTelemetryPreview(value.preview) &&
    isRuntimeTelemetryRender(value.render) &&
    isRuntimeTelemetryProcess(value.process) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeTelemetrySession(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.loaded === "boolean" &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    typeof value.sessionRevision === "number"
  );
}

function isRuntimeTelemetryPreview(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRuntimePreviewState(value.state) &&
    (typeof value.pid === "number" || value.pid === null) &&
    typeof value.stale === "boolean" &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    (typeof value.sessionRevision === "number" || value.sessionRevision === null) &&
    (typeof value.previewSessionRevision === "number" || value.previewSessionRevision === null)
  );
}

function isRuntimeTelemetryRender(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.active === "boolean" &&
    (typeof value.backend === "string" || value.backend === null) &&
    (typeof value.renderer === "string" || value.renderer === null) &&
    typeof value.framesRendered === "number" &&
    (typeof value.approxFps === "number" || value.approxFps === null) &&
    (typeof value.lastFrameMs === "number" || value.lastFrameMs === null) &&
    (typeof value.lastError === "string" || value.lastError === null) &&
    (typeof value.sourceNodeId === "string" || value.sourceNodeId === null)
  );
}

function isRuntimeTelemetryProcess(value: unknown): boolean {
  return isRecord(value) && typeof value.runtimeVersion === "string" && typeof value.uptimeMs === "number";
}

function isRuntimePreviewState(value: unknown): boolean {
  return value === "stopped" || value === "starting" || value === "running" || value === "exited" || value === "error";
}

function isGraphPatchHistory(value: unknown): value is GraphPatchHistoryV01 {
  return validateGraphPatchHistory(value).ok;
}

function isRuntimeDiagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    (value.severity === "error" || value.severity === "warning" || value.severity === "info")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
