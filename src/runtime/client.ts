import { validateGraphDocument } from "@skenion/contracts";
import type {
  RuntimeApiResponse,
  RuntimeHealth,
  RuntimeInfo,
  RuntimePatchResponse,
  RuntimeProjectPayload,
  RuntimeSessionPatchRequest,
  RuntimeSessionResponse
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
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
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
