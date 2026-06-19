import type {
  GraphDocumentV01,
  GraphPatchEventV01,
  GraphPatchHistoryV01,
  GraphPatchV01,
  GeneratedShaderSourceMapV01,
  NodeDefinitionManifestV01,
  ShaderDiagnosticV01
} from "@skenion/contracts";

export type RuntimeConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface RuntimeProjectPayload {
  graph: GraphDocumentV01;
  nodes: NodeDefinitionManifestV01[];
}

export interface RuntimeHealth {
  ok: boolean;
  service: string;
  version: string;
}

export interface RuntimeInfo {
  name: string;
  version: string;
  apiVersion: string;
  capabilities: string[];
}

export interface RuntimeAsset {
  id: string;
  name: string;
  mimeType: string;
  kind: string;
  sizeBytes: number;
  runtimeUri: string;
}

export interface RuntimeAssetImportResponse {
  ok: boolean;
  asset: RuntimeAsset | null;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeAssetListResponse {
  ok: boolean;
  assets: RuntimeAsset[];
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeAssetGetResponse {
  ok: boolean;
  asset: RuntimeAsset | null;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimeDiagnosticSeverity = "error" | "warning" | "info";

export interface RuntimeDiagnostic {
  severity: RuntimeDiagnosticSeverity;
  message: string;
}

export interface RuntimePlan {
  graphId: string;
  graphRevision: string;
  nodes: RuntimePlanNode[];
  edges: RuntimePlanEdge[];
  groups: RuntimeExecutionGroup[];
}

export interface RuntimePlanNode {
  nodeId: string;
  kind: string;
  kindVersion: string;
  executionModel: string;
  order: number;
}

export interface RuntimePlanEdge {
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
  metadata?: RuntimePlanEdgeMetadata | null;
}

export interface RuntimePlanEdgeMetadata {
  resolvedType?: string | null;
  mergePolicy?: string | null;
  fanOutPolicy?: string | null;
  order?: number | null;
  feedback?: {
    boundary: string;
    bufferMode?: string;
    maxLatencyFrames?: number;
  } | null;
  cycleClassification?: string | null;
}

export interface RuntimeExecutionGroup {
  executionModel: string;
  nodeIds: string[];
}

export interface RuntimeDummyExecutionReport {
  graphId: string;
  graphRevision: string;
  frameCount: number;
  frames: RuntimeDummyFrameReport[];
}

export interface RuntimeDummyFrameReport {
  index: number;
  executedNodes: RuntimeDummyNodeExecution[];
}

export interface RuntimeDummyNodeExecution {
  nodeId: string;
  kind: string;
  kindVersion: string;
  executionModel: string;
  order: number;
  status: string;
}

export interface RuntimeApiResponse {
  ok: boolean;
  diagnostics: RuntimeDiagnostic[];
  plan: RuntimePlan | null;
  report: RuntimeDummyExecutionReport | null;
}

export interface RuntimeSessionResponse {
  ok: boolean;
  loaded: boolean;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number;
  controlRevision: number;
  diagnostics: RuntimeDiagnostic[];
  plan: RuntimePlan | null;
  report: RuntimeDummyExecutionReport | null;
}

export interface RuntimeSessionProjectResponse {
  ok: boolean;
  loaded: boolean;
  project: RuntimeProjectPayload | null;
  session: RuntimeSessionResponse;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimePatchResponse {
  ok: boolean;
  applied: boolean;
  conflict: boolean;
  graph: GraphDocumentV01 | null;
  session: RuntimeSessionResponse;
  event: GraphPatchEventV01 | null;
  history: GraphPatchHistoryV01;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimePreviewState = "stopped" | "starting" | "running" | "exited" | "error";

export interface RuntimePreviewStatus {
  ok: boolean;
  state: RuntimePreviewState;
  pid: number | null;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number | null;
  previewSessionRevision: number | null;
  controlRevision: number | null;
  previewControlRevision: number | null;
  controlLive: boolean;
  lastControlUpdateAt: string | null;
  stale: boolean;
  startedAt: string | null;
  exitedAt: string | null;
  exitCode: number | null;
  message: string | null;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimePreviewStartRequest {
  restart: boolean;
}

export type RuntimeControlValue =
  | { type: "float"; representation: "f64" | "f32" | "f16" | "f8.e4m3" | "f8.e5m2" | "ufloat16" | "ufloat8"; value: number }
  | { type: "int"; representation: "i64" | "i32" | "i16" | "i8"; value: number }
  | { type: "uint"; representation: "u64" | "u32" | "u16" | "u8"; value: number }
  | { type: "bool"; value: boolean }
  | { type: "string"; value: string }
  | {
      type: "color";
      representation: "rgba32f" | "rgba16f" | "rgba8unorm" | "rgb8unorm";
      colorSpace: "linear" | "srgb";
      value: [number, number, number, number];
    };

export type RuntimeControlAtom = RuntimeControlValue;

export interface RuntimeControlMessage {
  selector: string;
  atoms: RuntimeControlAtom[];
}

export interface RuntimeControlEventRequest {
  nodeId: string;
  portId: "in" | "cold" | "value" | "out";
  message: RuntimeControlMessage;
}

export interface RuntimeControlEmission {
  nodeId: string;
  portId: "in" | "out" | "value";
  message: RuntimeControlMessage;
}

export interface RuntimeControlEventResponse {
  ok: boolean;
  changed: boolean;
  controlRevision: number | null;
  emitted: RuntimeControlEmission[];
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeControlStateResponse {
  ok: boolean;
  controlRevision: number;
  values: Record<string, RuntimeControlValue>;
  channels: Record<string, RuntimeControlMessage>;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimeControlReadTarget = "param" | "port" | "state";

export interface RuntimeControlReadRequest {
  nodeId: string;
  target: RuntimeControlReadTarget;
  id: string;
}

export type RuntimeControlReadValue =
  | RuntimeControlValue
  | {
      type: "json";
      value: unknown;
    };

export interface RuntimeControlReadResponse {
  ok: boolean;
  address: RuntimeControlReadRequest;
  value: RuntimeControlReadValue | null;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeTelemetrySnapshot {
  schema: "skenion.runtime.telemetry";
  schemaVersion: "0.1.0";
  ok: boolean;
  timestamp: string;
  session: RuntimeTelemetrySession;
  preview: RuntimeTelemetryPreview;
  render: RuntimeTelemetryRender;
  process: RuntimeTelemetryProcess;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeTelemetrySession {
  loaded: boolean;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number;
  controlRevision: number;
}

export interface RuntimeTelemetryPreview {
  state: RuntimePreviewState;
  pid: number | null;
  stale: boolean;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number | null;
  previewSessionRevision: number | null;
  controlRevision: number | null;
  previewControlRevision: number | null;
  controlLive: boolean;
  lastControlUpdateAt: string | null;
}

export interface RuntimeTelemetryRender {
  active: boolean;
  backend: string | null;
  renderer: string | null;
  framesRendered: number;
  approxFps: number | null;
  lastFrameMs: number | null;
  lastError: string | null;
  sourceNodeId: string | null;
  diagnostics: ShaderDiagnosticV01[];
  generatedSourceAvailable: boolean;
  controlRevision: number | null;
  previewControlRevision: number | null;
  controlLive: boolean;
  lastControlUpdateAt: string | null;
}

export interface RuntimeGeneratedShaderResponse {
  ok: boolean;
  nodeId: string | null;
  language: "wgsl" | null;
  source: string | null;
  sourceMap: GeneratedShaderSourceMapV01 | null;
  diagnostics: ShaderDiagnosticV01[];
}

export interface RuntimeTelemetryProcess {
  runtimeVersion: string;
  uptimeMs: number;
}

export interface RuntimeSessionRunRequest {
  frames: number;
}

export type RuntimeSessionPatchRequest = GraphPatchV01;

export type RuntimeResultKind =
  | "validate"
  | "plan"
  | "run"
  | "session"
  | "loadSession"
  | "validateSession"
  | "planSession"
  | "runSession"
  | "applyPatch"
  | "undoPatch"
  | "redoPatch"
  | "controlEvent"
  | "clearSession";

export type RuntimeActionResponse =
  | RuntimeApiResponse
  | RuntimePatchResponse
  | RuntimeSessionResponse
  | RuntimeControlEventResponse
  | RuntimeControlReadResponse;

export interface RuntimeActionResult {
  kind: RuntimeResultKind;
  response: RuntimeActionResponse;
  receivedAt: string;
}
