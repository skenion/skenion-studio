import type {
  RuntimeApiResponse,
  RuntimeControlEventResponse,
  RuntimeControlReadResponse,
  PasteGraphFragmentResponse,
  RuntimeProjectRequest,
  RuntimeMutationResponse,
  RuntimeSessionResponse
} from "@skenion/contracts";

export type {
  ClockFieldV01,
  ClockStateV01,
  ClockTimeSignatureV01,
  ExtensionManifestV01,
  RuntimeApiResponse,
  RuntimeAsset,
  RuntimeAssetGetResponse,
  RuntimeAssetImportResponse,
  RuntimeAssetListResponse,
  RuntimeControlAtom,
  RuntimeControlEmission,
  RuntimeControlEventRequest,
  RuntimeControlEventResponse,
  RuntimeControlMessage,
  RuntimeControlReadRequest,
  RuntimeControlReadResponse,
  RuntimeControlReadTarget,
  RuntimeControlReadValue,
  RuntimeControlStateResponse,
  RuntimeControlValue,
  RuntimeDiagnostic,
  RuntimeDiagnosticSeverity,
  RuntimeDummyExecutionReport,
  RuntimeDummyFrameReport,
  RuntimeDummyNodeExecution,
  RuntimeExecutionGroup,
  RuntimeExtensionDescriptor,
  RuntimeExtensionListResponse,
  RuntimeExtensionStatus,
  RuntimeGeneratedShaderResponse,
  RuntimeHealth,
  RuntimeHistory,
  RuntimeHistoryEntry,
  RuntimeHistoryEntryKind,
  RuntimeInfo,
  RuntimeIoBindingConfig,
  RuntimeIoDeviceDescriptor,
  RuntimeIoDeviceListResponse,
  RuntimeIoDiagnostic,
  RuntimeIoDiagnosticSeverity,
  RuntimeIoDirection,
  RuntimeIoInlineFrame,
  RuntimeIoTransportKind,
  RuntimeLogEvent,
  RuntimeLogRetention,
  RuntimeLogSnapshotResponse,
  RuntimeMutationRequest,
  RuntimeMutationResponse,
  RuntimeOperationEnvelope,
  PasteGraphFragmentResponse,
  RuntimePlan,
  RuntimePlanEdge,
  RuntimePlanEdgeMetadata,
  RuntimePlanNode,
  RuntimePreviewStartRequest,
  RuntimePreviewState,
  RuntimePreviewStatus,
  RuntimeConnectionProfile,
  RuntimeConnectionProfileMode,
  RuntimeEndpointMetadata,
  RuntimeOwnershipMode,
  RuntimeSessionCapabilitySet,
  RuntimeProjectRequest,
  RuntimeProjectSnapshot,
  RuntimeSessionEvent,
  RuntimeSessionEventKind,
  RuntimeSessionInfoResponse,
  RuntimeSessionLifecycleState,
  RuntimeSessionResponse,
  RuntimeSessionRunRequest,
  RuntimeSessionSnapshot,
  RuntimeTelemetryPreview,
  RuntimeTelemetryProcess,
  RuntimeTelemetryRender,
  RuntimeTelemetrySession,
  RuntimeTelemetrySnapshot,
  RuntimeViewPatch,
  RuntimeViewPatchOperation
} from "@skenion/contracts";

export type RuntimePatchResponse = RuntimeMutationResponse;

export type RuntimeConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type RuntimeProjectPayload = RuntimeProjectRequest;

export type RuntimeResultKind =
  | "validate"
  | "plan"
  | "run"
  | "session"
  | "loadSession"
  | "validateSession"
  | "planSession"
  | "runSession"
  | "mutateSession"
  | "sessionOperation"
  | "undoPatch"
  | "redoPatch"
  | "controlEvent"
  | "clearSession";

export type RuntimeActionResponse =
  | RuntimeApiResponse
  | RuntimePatchResponse
  | RuntimeSessionResponse
  | PasteGraphFragmentResponse
  | RuntimeControlEventResponse
  | RuntimeControlReadResponse;

export interface RuntimeActionResult {
  kind: RuntimeResultKind;
  response: RuntimeActionResponse;
  receivedAt: string;
}
