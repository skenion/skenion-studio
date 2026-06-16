import type {
  GraphDocumentV01,
  GraphPatchV01,
  NodeDefinitionManifestV01
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
  diagnostics: RuntimeDiagnostic[];
  plan: RuntimePlan | null;
  report: RuntimeDummyExecutionReport | null;
}

export interface RuntimePatchResponse {
  ok: boolean;
  applied: boolean;
  conflict: boolean;
  graph: GraphDocumentV01 | null;
  session: RuntimeSessionResponse;
  diagnostics: RuntimeDiagnostic[];
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
  | "clearSession";

export type RuntimeActionResponse = RuntimeApiResponse | RuntimePatchResponse | RuntimeSessionResponse;

export interface RuntimeActionResult {
  kind: RuntimeResultKind;
  response: RuntimeActionResponse;
  receivedAt: string;
}
