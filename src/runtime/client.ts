import {
  isRuntimeApiResponse,
  isRuntimeAssetGetResponse,
  isRuntimeAssetImportResponse,
  isRuntimeAssetListResponse,
  isRuntimeControlEventResponse,
  isRuntimeControlReadResponse,
  isRuntimeControlStateResponse,
  isRuntimeExtensionListResponse,
  isRuntimeGeneratedShaderResponse,
  isRuntimeHealth,
  isRuntimeHistory,
  isRuntimeInfo,
  isRuntimeIoDeviceListResponse,
  isRuntimeLogSnapshotResponse,
  isPasteGraphFragmentResponse,
  isRuntimePreviewStatus,
  isRuntimeSessionInfoResponse,
  isRuntimeSessionResponse,
  isRuntimeTelemetrySnapshot
} from "@skenion/contracts/runtime/http";
import type {
  RuntimeApiResponse,
  RuntimeAssetGetResponse,
  RuntimeAssetImportResponse,
  RuntimeAssetListResponse,
  RuntimeControlEventRequest,
  RuntimeControlEventResponse,
  RuntimeControlReadRequest,
  RuntimeControlReadResponse,
  RuntimeControlStateResponse,
  RuntimeHealth,
  RuntimeInfo,
  RuntimeLogSnapshotResponse,
  RuntimeIoDeviceListResponse,
  RuntimeGeneratedShaderResponse,
  RuntimeExtensionListResponse,
  RuntimeHistory,
  RuntimeMutationRequest,
  RuntimeOperationEnvelope,
  PasteGraphFragmentResponse,
  RuntimePatchResponse,
  RuntimePreviewStartRequest,
  RuntimePreviewStatus,
  RuntimeProjectPayload,
  RuntimeSessionInfoResponse,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "./types";

export const DEFAULT_RUNTIME_URL =
  import.meta.env.VITE_SKENION_RUNTIME_URL?.trim() || "http://localhost:3761";

export { isRuntimeLogEvent, isRuntimeSessionEvent } from "@skenion/contracts/runtime/http";

type FetchLike = typeof fetch;

export interface RuntimeClient {
  getHealth: () => Promise<RuntimeHealth>;
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  getRuntimeLogs: () => Promise<RuntimeLogSnapshotResponse>;
  listExtensions: () => Promise<RuntimeExtensionListResponse>;
  validateProject: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  buildPlan: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  runProject: (project: RuntimeProjectPayload, frames: number) => Promise<RuntimeApiResponse>;
  getSessionInfo: () => Promise<RuntimeSessionInfoResponse>;
  getSession: () => Promise<RuntimeSessionResponse>;
  loadSession: (project: RuntimeProjectPayload) => Promise<RuntimeSessionResponse>;
  validateSession: () => Promise<RuntimeSessionResponse>;
  planSession: () => Promise<RuntimeSessionResponse>;
  runSession: (frames: number) => Promise<RuntimeSessionResponse>;
  mutateSession: (mutation: RuntimeMutationRequest) => Promise<RuntimePatchResponse>;
  runSessionOperation: (operation: RuntimeOperationEnvelope) => Promise<PasteGraphFragmentResponse>;
  getSessionHistory: () => Promise<RuntimeHistory>;
  undoSessionPatch: () => Promise<RuntimePatchResponse>;
  redoSessionPatch: () => Promise<RuntimePatchResponse>;
  sendControlEvent: (request: RuntimeControlEventRequest) => Promise<RuntimeControlEventResponse>;
  getControlState: () => Promise<RuntimeControlStateResponse>;
  readControl: (request: RuntimeControlReadRequest) => Promise<RuntimeControlReadResponse>;
  getPreviewStatus: () => Promise<RuntimePreviewStatus>;
  startPreview: (options?: Partial<RuntimePreviewStartRequest>) => Promise<RuntimePreviewStatus>;
  stopPreview: () => Promise<RuntimePreviewStatus>;
  restartPreview: () => Promise<RuntimePreviewStatus>;
  importAsset: (file: File, kind?: string) => Promise<RuntimeAssetImportResponse>;
  listAssets: () => Promise<RuntimeAssetListResponse>;
  getAsset: (assetId: string) => Promise<RuntimeAssetGetResponse>;
  getGeneratedShader: () => Promise<RuntimeGeneratedShaderResponse>;
  getTelemetry: () => Promise<RuntimeTelemetrySnapshot>;
  listIoDevices: () => Promise<RuntimeIoDeviceListResponse>;
  clearSession: () => Promise<RuntimeSessionResponse>;
}

export interface RuntimeClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  sessionId?: string | null;
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
  const sessionId = normalizeRuntimeSessionId(options.sessionId);
  const sessionPath = (suffix = "") => runtimeSessionPath(sessionId, suffix);

  return {
    getHealth: () => requestJson<RuntimeHealth>(fetchImpl, baseUrl, "/health", { method: "GET" }, isRuntimeHealth),
    getRuntimeInfo: () =>
      requestJson<RuntimeInfo>(fetchImpl, baseUrl, "/v0/runtime/info", { method: "GET" }, isRuntimeInfo),
    getRuntimeLogs: () =>
      requestJson<RuntimeLogSnapshotResponse>(
        fetchImpl,
        baseUrl,
        "/v0/runtime/logs",
        { method: "GET" },
        isRuntimeLogSnapshotResponse
      ),
    listExtensions: () =>
      requestJson<RuntimeExtensionListResponse>(
        fetchImpl,
        baseUrl,
        "/v0/extensions",
        { method: "GET" },
        isRuntimeExtensionListResponse
      ),
    validateProject: (project) => postRuntimeResponse(fetchImpl, baseUrl, "/v0/validate", project),
    buildPlan: (project) => postRuntimeResponse(fetchImpl, baseUrl, "/v0/plan", project),
    runProject: (project, frames) =>
      postRuntimeResponse(fetchImpl, baseUrl, "/v0/run", {
        ...project,
        frames
      }),
    getSessionInfo: () =>
      requestJson<RuntimeSessionInfoResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/info"),
        { method: "GET" },
        isRuntimeSessionInfoResponse
      ),
    getSession: () =>
      requestJson<RuntimeSessionResponse>(fetchImpl, baseUrl, sessionPath(), { method: "GET" }, isRuntimeSessionResponse),
    loadSession: (project) => postRuntimeSessionResponse(fetchImpl, baseUrl, sessionPath("/load"), project),
    validateSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/validate"),
        { method: "POST" },
        isRuntimeSessionResponse
      ),
    planSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/plan"),
        { method: "POST" },
        isRuntimeSessionResponse
      ),
    runSession: (frames) => postRuntimeSessionResponse(fetchImpl, baseUrl, sessionPath("/run"), { frames }),
    mutateSession: (mutation) => postRuntimePatchResponse(fetchImpl, baseUrl, sessionPath("/mutate"), mutation),
    runSessionOperation: (operation) =>
      postRuntimeOperationResponse(fetchImpl, baseUrl, sessionPath("/operation"), operation),
    getSessionHistory: () =>
      requestJson<RuntimeHistory>(
        fetchImpl,
        baseUrl,
        sessionPath("/history"),
        { method: "GET" },
        isRuntimeHistory
      ),
    undoSessionPatch: () =>
      requestJson<RuntimePatchResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/undo"),
        { method: "POST" },
        isRuntimePatchResponse
      ),
    redoSessionPatch: () =>
      requestJson<RuntimePatchResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/redo"),
        { method: "POST" },
        isRuntimePatchResponse
      ),
    sendControlEvent: (request) =>
      postRuntimeControlEventResponse(fetchImpl, baseUrl, sessionPath("/control/event"), request),
    getControlState: () =>
      requestJson<RuntimeControlStateResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/control/state"),
        { method: "GET" },
        isRuntimeControlStateResponse
      ),
    readControl: (request) =>
      requestJson<RuntimeControlReadResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/control/read"),
        {
          body: JSON.stringify(request),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        },
        isRuntimeControlReadResponse
      ),
    getPreviewStatus: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        sessionPath("/preview"),
        { method: "GET" },
        isRuntimePreviewStatus
      ),
    startPreview: (options = {}) =>
      postRuntimePreviewStatus(fetchImpl, baseUrl, sessionPath("/preview/start"), {
        restart: options.restart ?? false
      }),
    stopPreview: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        sessionPath("/preview/stop"),
        { method: "POST" },
        isRuntimePreviewStatus
      ),
    restartPreview: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        sessionPath("/preview/restart"),
        { method: "POST" },
        isRuntimePreviewStatus
      ),
    importAsset: (file, kind) => {
      void kind;
      const form = new FormData();
      form.set("file", file);
      return requestJson<RuntimeAssetImportResponse>(
        fetchImpl,
        baseUrl,
        "/v0/assets/import",
        {
          body: form,
          method: "POST"
        },
        isRuntimeAssetImportResponse
      );
    },
    listAssets: () =>
      requestJson<RuntimeAssetListResponse>(
        fetchImpl,
        baseUrl,
        "/v0/assets",
        { method: "GET" },
        isRuntimeAssetListResponse
      ),
    getAsset: (assetId) =>
      requestJson<RuntimeAssetGetResponse>(
        fetchImpl,
        baseUrl,
        `/v0/assets/${encodeURIComponent(assetId)}`,
        { method: "GET" },
        isRuntimeAssetGetResponse
      ),
    getGeneratedShader: () =>
      requestJson<RuntimeGeneratedShaderResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/render/generated-shader"),
        { method: "GET" },
        isRuntimeGeneratedShaderResponse
      ),
    getTelemetry: () =>
      requestJson<RuntimeTelemetrySnapshot>(
        fetchImpl,
        baseUrl,
        sessionPath("/telemetry"),
        { method: "GET" },
        isRuntimeTelemetrySnapshot
      ),
    listIoDevices: () =>
      requestJson<RuntimeIoDeviceListResponse>(
        fetchImpl,
        baseUrl,
        "/v0/io/devices",
        { method: "GET" },
        isRuntimeIoDeviceListResponse
      ),
    clearSession: () =>
      requestJson<RuntimeSessionResponse>(fetchImpl, baseUrl, sessionPath(), { method: "DELETE" }, isRuntimeSessionResponse)
  };
}

export function normalizeRuntimeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new RuntimeClientError("Runtime URL is required.");
  }

  return trimmed.replace(/\/+$/, "");
}

export function normalizeRuntimeSessionId(sessionId?: string | null): string | null {
  const trimmed = sessionId?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function runtimeSessionPath(sessionId?: string | null, suffix = ""): string {
  const normalizedSessionId = normalizeRuntimeSessionId(sessionId);
  if (!normalizedSessionId) {
    return `/v0/session${suffix}`;
  }
  return `/v0/sessions/${encodeURIComponent(normalizedSessionId)}${suffix}`;
}

export function runtimeLogStreamUrl(url: string = DEFAULT_RUNTIME_URL): string {
  return `${normalizeRuntimeUrl(url)}/v0/runtime/logs/stream`;
}

export function runtimeSessionEventsStreamUrl(
  url: string = DEFAULT_RUNTIME_URL,
  sessionId?: string | null
): string {
  return `${normalizeRuntimeUrl(url)}${runtimeSessionPath(sessionId, "/events/stream")}`;
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

function isRuntimePatchResponse(value: unknown): value is RuntimePatchResponse {
  if (
    !isRecord(value) ||
    typeof value.ok !== "boolean" ||
    typeof value.applied !== "boolean" ||
    typeof value.conflict !== "boolean" ||
    !isRuntimeHistory(value.history)
  ) {
    return false;
  }

  return isRuntimeSessionResponse({
    ok: value.ok,
    snapshot: value.snapshot,
    diagnostics: value.diagnostics,
    report: null
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function postRuntimeOperationResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: RuntimeOperationEnvelope
): Promise<PasteGraphFragmentResponse> {
  return requestJson<PasteGraphFragmentResponse>(
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
    isPasteGraphFragmentResponse
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
