import {
  validateGraphDocument,
  validateGraphPatch,
  validateViewState
} from "@skenion/contracts";
import type {
  RuntimeApiResponse,
  RuntimeAssetGetResponse,
  RuntimeAssetImportResponse,
  RuntimeAssetListResponse,
  RuntimeControlEventRequest,
  RuntimeControlEventResponse,
  RuntimeControlMessage,
  RuntimeControlReadRequest,
  RuntimeControlReadResponse,
  RuntimeControlStateResponse,
  RuntimeControlValue,
  RuntimeHealth,
  RuntimeInfo,
  RuntimeDiagnosticSeverity,
  RuntimeLogEvent,
  RuntimeLogSnapshotResponse,
  RuntimeIoDeviceListResponse,
  RuntimeGeneratedShaderResponse,
  RuntimeHistory,
  RuntimeMutationRequest,
  RuntimePatchResponse,
  RuntimePreviewStartRequest,
  RuntimePreviewStatus,
  RuntimeProjectPayload,
  RuntimeSessionEvent,
  RuntimeSessionResponse,
  RuntimeSessionSnapshot,
  RuntimeTelemetrySnapshot
} from "./types";

export const DEFAULT_RUNTIME_URL =
  import.meta.env.VITE_SKENION_RUNTIME_URL?.trim() || "http://localhost:3761";

type FetchLike = typeof fetch;

const SHADER_DIAGNOSTIC_SEVERITIES = new Set(["error", "warning", "info"]);
const SHADER_DIAGNOSTIC_PHASES = new Set([
  "interface-analysis",
  "source-sync",
  "wgsl-generation",
  "wgsl-compile",
  "render-pipeline",
  "render-frame"
]);
const SHADER_DIAGNOSTIC_SOURCES = new Set(["user", "generated", "runtime"]);

export interface RuntimeClient {
  getHealth: () => Promise<RuntimeHealth>;
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  getRuntimeLogs: () => Promise<RuntimeLogSnapshotResponse>;
  validateProject: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  buildPlan: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  runProject: (project: RuntimeProjectPayload, frames: number) => Promise<RuntimeApiResponse>;
  getSession: () => Promise<RuntimeSessionResponse>;
  loadSession: (project: RuntimeProjectPayload) => Promise<RuntimeSessionResponse>;
  validateSession: () => Promise<RuntimeSessionResponse>;
  planSession: () => Promise<RuntimeSessionResponse>;
  runSession: (frames: number) => Promise<RuntimeSessionResponse>;
  mutateSession: (mutation: RuntimeMutationRequest) => Promise<RuntimePatchResponse>;
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
    getRuntimeLogs: () =>
      requestJson<RuntimeLogSnapshotResponse>(
        fetchImpl,
        baseUrl,
        "/v0/runtime/logs",
        { method: "GET" },
        isRuntimeLogSnapshotResponse
      ),
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
    mutateSession: (mutation) => postRuntimePatchResponse(fetchImpl, baseUrl, "/v0/session/mutate", mutation),
    getSessionHistory: () =>
      requestJson<RuntimeHistory>(
        fetchImpl,
        baseUrl,
        "/v0/session/history",
        { method: "GET" },
        isRuntimeHistory
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
    readControl: (request) =>
      requestJson<RuntimeControlReadResponse>(
        fetchImpl,
        baseUrl,
        "/v0/session/control/read",
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
        "/v0/session/render/generated-shader",
        { method: "GET" },
        isRuntimeGeneratedShaderResponse
      ),
    getTelemetry: () =>
      requestJson<RuntimeTelemetrySnapshot>(
        fetchImpl,
        baseUrl,
        "/v0/session/telemetry",
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

export function runtimeLogStreamUrl(url: string = DEFAULT_RUNTIME_URL): string {
  return `${normalizeRuntimeUrl(url)}/v0/runtime/logs/stream`;
}

export function runtimeSessionEventsStreamUrl(url: string = DEFAULT_RUNTIME_URL): string {
  return `${normalizeRuntimeUrl(url)}/v0/session/events/stream`;
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

function isRuntimeLogSnapshotResponse(value: unknown): value is RuntimeLogSnapshotResponse {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.logs" &&
    typeof value.schemaVersion === "string" &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.events) &&
    value.events.every(isRuntimeLogEvent) &&
    isRecord(value.retention) &&
    typeof value.retention.replayLimit === "number" &&
    Array.isArray(value.retention.replayLevels) &&
    value.retention.replayLevels.every(isRuntimeDiagnosticSeverity) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

export function isRuntimeLogEvent(value: unknown): value is RuntimeLogEvent {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.timestamp === "string" &&
    value.source === "runtime" &&
    isRuntimeDiagnosticSeverity(value.level) &&
    (value.code === null || typeof value.code === "string") &&
    typeof value.message === "string"
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
    !("loaded" in value) &&
    !("graphId" in value) &&
    !("graphRevision" in value) &&
    !("viewState" in value) &&
    isRuntimeSessionSnapshot(value.snapshot) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.report === null || isRecord(value.report))
  );
}

function isRuntimeSessionSnapshot(value: unknown): value is RuntimeSessionSnapshot {
  return (
    isRecord(value) &&
    typeof value.sessionRevision === "number" &&
    typeof value.viewRevision === "number" &&
    typeof value.controlRevision === "number" &&
    (value.project === null || isRuntimeProjectSnapshot(value.project)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.plan === null || isRecord(value.plan))
  );
}

function isRuntimeProjectSnapshot(value: unknown): boolean {
  return (
    isRecord(value) &&
    validateGraphDocument(value.graph).ok &&
    validateViewState(value.viewState).ok &&
    Array.isArray(value.nodes) &&
    value.nodes.every((node) => isRecord(node) && typeof node.id === "string")
  );
}

function isRuntimePatchResponse(value: unknown): value is RuntimePatchResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.applied === "boolean" &&
    typeof value.conflict === "boolean" &&
    !("graph" in value) &&
    !("viewState" in value) &&
    !("session" in value) &&
    !("event" in value) &&
    isRuntimeSessionSnapshot(value.snapshot) &&
    isRuntimeHistory(value.history) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

export function isRuntimeSessionEvent(value: unknown): value is RuntimeSessionEvent {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.session.event" &&
    typeof value.schemaVersion === "string" &&
    typeof value.id === "string" &&
    typeof value.sequence === "number" &&
    isRuntimeSessionEventKind(value.kind) &&
    isRuntimeSessionSnapshot(value.snapshot) &&
    !("session" in value) &&
    !("graph" in value) &&
    !("viewState" in value) &&
    !("graphEvent" in value) &&
    isRuntimeHistory(value.history) &&
    (value.mutation === undefined || isRuntimeHistoryEntry(value.mutation)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    typeof value.createdAt === "string"
  );
}

function isRuntimeSessionEventKind(value: unknown): boolean {
  return (
    value === "snapshot" ||
    value === "load" ||
    value === "clear" ||
    value === "mutate" ||
    value === "undo" ||
    value === "redo"
  );
}

function isRuntimeControlEventResponse(value: unknown): value is RuntimeControlEventResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.changed === "boolean" &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
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
    typeof value.controlRevision === "number" &&
    isRecord(value.values) &&
    Object.values(value.values).every(isRuntimeControlValue) &&
    isRecord(value.channels) &&
    Object.values(value.channels).every(isRuntimeControlMessage) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlReadResponse(value: unknown): value is RuntimeControlReadResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    isRuntimeControlReadRequest(value.address) &&
    (value.value === null || isRuntimeControlReadValue(value.value)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlReadRequest(value: unknown): value is RuntimeControlReadRequest {
  return (
    isRecord(value) &&
    typeof value.nodeId === "string" &&
    (value.target === "param" || value.target === "port" || value.target === "state") &&
    typeof value.id === "string"
  );
}

function isRuntimeControlReadValue(value: unknown): boolean {
  return (
    isRuntimeControlValue(value) ||
    (isRecord(value) && value.type === "json" && "value" in value)
  );
}

function isRuntimeControlEmission(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.nodeId === "string" &&
    (value.portId === "value" || value.portId === "in" || value.portId === "out") &&
    isRuntimeControlMessage(value.message)
  );
}

function isRuntimeControlMessage(value: unknown): value is RuntimeControlMessage {
  return (
    isRecord(value) &&
    typeof value.selector === "string" &&
    Array.isArray(value.atoms) &&
    value.atoms.every(isRuntimeControlValue)
  );
}

function isRuntimeControlValue(value: unknown): value is RuntimeControlValue {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  if (value.type === "float") {
    return (
      typeof value.representation === "string" &&
      typeof value.value === "number" &&
      Number.isFinite(value.value)
    );
  }
  if (value.type === "int" || value.type === "uint") {
    return (
      typeof value.representation === "string" &&
      typeof value.value === "number" &&
      Number.isInteger(value.value)
    );
  }
  if (value.type === "bool") {
    return typeof value.value === "boolean";
  }
  if (value.type === "string") {
    return typeof value.value === "string";
  }
  if (value.type === "color") {
    return (
      typeof value.representation === "string" &&
      typeof value.colorSpace === "string" &&
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
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    (typeof value.previewControlRevision === "number" || value.previewControlRevision === null) &&
    typeof value.controlLive === "boolean" &&
    (typeof value.lastControlUpdateAt === "string" || value.lastControlUpdateAt === null) &&
    typeof value.stale === "boolean" &&
    (typeof value.startedAt === "string" || value.startedAt === null) &&
    (typeof value.exitedAt === "string" || value.exitedAt === null) &&
    (typeof value.exitCode === "number" || value.exitCode === null) &&
    (typeof value.message === "string" || value.message === null) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeAsset(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.kind === "string" &&
    typeof value.sizeBytes === "number" &&
    Number.isFinite(value.sizeBytes) &&
    typeof value.runtimeUri === "string"
  );
}

function isRuntimeAssetImportResponse(value: unknown): value is RuntimeAssetImportResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    (value.asset === null || isRuntimeAsset(value.asset)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeAssetListResponse(value: unknown): value is RuntimeAssetListResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.assets) &&
    value.assets.every(isRuntimeAsset) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeAssetGetResponse(value: unknown): value is RuntimeAssetGetResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    (value.asset === null || isRuntimeAsset(value.asset)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeIoDeviceListResponse(value: unknown): value is RuntimeIoDeviceListResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.devices) &&
    value.devices.every(isRuntimeIoDeviceDescriptor) &&
    isRuntimeIoDiagnostics(value.diagnostics)
  );
}

function isRuntimeIoDeviceDescriptor(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isRuntimeIoTransportKind(value.transportKind) &&
    Array.isArray(value.directions) &&
    value.directions.every(isRuntimeIoDirection) &&
    typeof value.backend === "string" &&
    (value.index === undefined || (typeof value.index === "number" && Number.isInteger(value.index) && value.index >= 0)) &&
    typeof value.stable === "boolean"
  );
}

function isRuntimeIoTransportKind(value: unknown): boolean {
  return value === "midi" || value === "hid" || value === "serial" || value === "inline";
}

function isRuntimeIoDirection(value: unknown): boolean {
  return value === "input" || value === "output";
}

function isRuntimeIoDiagnostics(value: unknown): boolean {
  return Array.isArray(value) && value.every(isRuntimeIoDiagnostic);
}

function isRuntimeIoDiagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.severity === "error" || value.severity === "warning") &&
    typeof value.code === "string" &&
    typeof value.message === "string"
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
    typeof value.sessionRevision === "number" &&
    typeof value.controlRevision === "number"
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
    (typeof value.previewSessionRevision === "number" || value.previewSessionRevision === null) &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    (typeof value.previewControlRevision === "number" || value.previewControlRevision === null) &&
    typeof value.controlLive === "boolean" &&
    (typeof value.lastControlUpdateAt === "string" || value.lastControlUpdateAt === null)
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
    (typeof value.sourceNodeId === "string" || value.sourceNodeId === null) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isShaderDiagnostic) &&
    typeof value.generatedSourceAvailable === "boolean" &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    (typeof value.previewControlRevision === "number" || value.previewControlRevision === null) &&
    typeof value.controlLive === "boolean" &&
    (typeof value.lastControlUpdateAt === "string" || value.lastControlUpdateAt === null)
  );
}

function isRuntimeGeneratedShaderResponse(value: unknown): value is RuntimeGeneratedShaderResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    (typeof value.nodeId === "string" || value.nodeId === null) &&
    (value.language === "wgsl" || value.language === null) &&
    (typeof value.source === "string" || value.source === null) &&
    (value.sourceMap === null || isGeneratedShaderSourceMap(value.sourceMap)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isShaderDiagnostic)
  );
}

function isGeneratedShaderSourceMap(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.userSourceStartLine === "number" &&
    Number.isInteger(value.userSourceStartLine) &&
    value.userSourceStartLine >= 1 &&
    typeof value.generatedLineOffset === "number" &&
    Number.isInteger(value.generatedLineOffset) &&
    value.generatedLineOffset >= 0
  );
}

function isRuntimeTelemetryProcess(value: unknown): boolean {
  return isRecord(value) && typeof value.runtimeVersion === "string" && typeof value.uptimeMs === "number";
}

function isRuntimePreviewState(value: unknown): boolean {
  return value === "stopped" || value === "starting" || value === "running" || value === "exited" || value === "error";
}

function isRuntimeHistory(value: unknown): value is RuntimeHistory {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.history" &&
    typeof value.schemaVersion === "string" &&
    Array.isArray(value.entries) &&
    value.entries.every(isRuntimeHistoryEntry) &&
    typeof value.canUndo === "boolean" &&
    typeof value.canRedo === "boolean" &&
    typeof value.undoDepth === "number" &&
    typeof value.redoDepth === "number"
  );
}

function isRuntimeHistoryEntry(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sequence === "number" &&
    (value.kind === "apply" || value.kind === "undo" || value.kind === "redo") &&
    isRuntimeMutationRequest(value.mutation) &&
    isRuntimeMutationRequest(value.inverseMutation) &&
    (value.subjectEventId === undefined || typeof value.subjectEventId === "string") &&
    (value.clientId === undefined || typeof value.clientId === "string") &&
    (value.description === undefined || typeof value.description === "string") &&
    typeof value.createdAt === "string"
  );
}

function isRuntimeMutationRequest(value: unknown): value is RuntimeMutationRequest {
  return (
    isRecord(value) &&
    (value.graphPatch === undefined || validateGraphPatch(value.graphPatch).ok) &&
    (value.viewPatch === undefined || isRuntimeViewPatch(value.viewPatch)) &&
    (value.clientId === undefined || typeof value.clientId === "string") &&
    (value.description === undefined || typeof value.description === "string")
  );
}

function isRuntimeViewPatch(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.baseViewRevision === "number" &&
    Array.isArray(value.ops) &&
    value.ops.every(isRuntimeViewPatchOperation)
  );
}

function isRuntimeViewPatchOperation(value: unknown): boolean {
  if (!isRecord(value) || typeof value.nodeId !== "string") {
    return false;
  }
  if (value.op === "setNodeView") {
    return isCanvasNodeView(value.view);
  }
  if (value.op === "moveNodeView") {
    return (value.from === undefined || isCanvasNodeView(value.from)) && isCanvasNodeView(value.to);
  }
  return false;
}

function isCanvasNodeView(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    (value.width === undefined || (typeof value.width === "number" && Number.isFinite(value.width))) &&
    (value.height === undefined || (typeof value.height === "number" && Number.isFinite(value.height))) &&
    (value.collapsed === undefined || typeof value.collapsed === "boolean")
  );
}

function isRuntimeDiagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    isRuntimeDiagnosticSeverity(value.severity)
  );
}

function isRuntimeDiagnosticSeverity(value: unknown): value is RuntimeDiagnosticSeverity {
  return value === "error" || value === "warning" || value === "info";
}

function isShaderDiagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.severity === "string" &&
    SHADER_DIAGNOSTIC_SEVERITIES.has(value.severity) &&
    typeof value.phase === "string" &&
    SHADER_DIAGNOSTIC_PHASES.has(value.phase) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.source === "string" &&
    SHADER_DIAGNOSTIC_SOURCES.has(value.source) &&
    optionalPositiveInteger(value.line) &&
    optionalPositiveInteger(value.column) &&
    optionalPositiveInteger(value.endLine) &&
    optionalPositiveInteger(value.endColumn) &&
    (typeof value.uniformId === "string" || value.uniformId === undefined)
  );
}

function optionalPositiveInteger(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
