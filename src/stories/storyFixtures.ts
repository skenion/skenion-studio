import type {
  EdgeV01,
  GraphDocumentV01,
  GraphPatchEventV01,
  GraphPatchHistoryV01,
  ValidationResult
} from "@skenion/contracts";
import type { EdgeInspectorModel, GraphSemanticDiagnostic } from "../graph/portSemantics";
import type { NodeCardView, NodePortView } from "../components/node/nodeTypes";
import type {
  RuntimeInfo,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../runtime/types";

export const noop = () => undefined;

export const valueOutputPort: NodePortView = {
  id: "value",
  label: "value",
  direction: "output",
  typeLabel: "value.f32",
  color: "#495057",
  metadata: {
    rate: "control",
    fanOutPolicy: "allow",
    triggerMode: "passive"
  }
};

export const valueInputPort: NodePortView = {
  id: "amount",
  label: "amount",
  direction: "input",
  typeLabel: "value.f32",
  color: "#495057",
  metadata: {
    rate: "control",
    maxConnections: 1,
    mergePolicy: "forbid",
    triggerMode: "latched",
    required: true
  }
};

export const shaderUniformInputPort: NodePortView = {
  ...valueInputPort,
  id: "u_value",
  label: "u_value",
  metadata: {
    ...valueInputPort.metadata,
    required: false
  }
};

export const renderFrameOutputPort: NodePortView = {
  id: "out",
  label: "out",
  direction: "output",
  typeLabel: "render.frame",
  color: "#d6336c",
  metadata: {
    rate: "frame",
    fanOutPolicy: "allow",
    triggerMode: "passive"
  }
};

export const renderFrameInputPort: NodePortView = {
  id: "in",
  label: "in",
  direction: "input",
  typeLabel: "render.frame",
  color: "#d6336c",
  metadata: {
    rate: "frame",
    maxConnections: 1,
    mergePolicy: "forbid",
    triggerMode: "passive",
    required: true
  }
};

export const gpuTextureOutputPort: NodePortView = {
  id: "texture",
  label: "texture",
  direction: "output",
  typeLabel: "gpu.texture2d",
  color: "#7048e8",
  metadata: {
    rate: "frame",
    fanOutPolicy: "reference",
    triggerMode: "passive"
  }
};

export const eventInputPort: NodePortView = {
  id: "bang",
  label: "bang",
  direction: "input",
  typeLabel: "event.bang",
  color: "#f08c00",
  metadata: {
    rate: "event",
    maxConnections: null,
    mergePolicy: "ordered-events",
    triggerMode: "trigger"
  }
};

export const zeroPortCard: NodeCardView = {
  id: "note_1",
  label: "Metadata",
  kind: "core.note",
  kindVersion: "0.2.0",
  accentColor: "#868e96",
  inputs: [],
  outputs: []
};

export const renderCard: NodeCardView = {
  id: "shader_1",
  label: "Fullscreen Shader",
  kind: "render.fullscreen-shader",
  kindVersion: "0.2.0",
  typeBadgeLabel: "render.frame",
  accentColor: "#d6336c",
  inputs: [],
  outputs: [renderFrameOutputPort]
};

export const shaderUniformCard: NodeCardView = {
  ...renderCard,
  inputs: [shaderUniformInputPort]
};

export const targetCard: NodeCardView = {
  id: "output_1",
  label: "Render Output",
  kind: "render.output",
  kindVersion: "0.2.0",
  typeBadgeLabel: "render.frame",
  accentColor: "#d6336c",
  inputs: [renderFrameInputPort],
  outputs: []
};

export const valueTransformCard: NodeCardView = {
  id: "scale_1",
  label: "Scale Value",
  kind: "core.scale-f32",
  kindVersion: "0.2.0",
  typeBadgeLabel: "value.f32",
  accentColor: "#495057",
  inputs: [valueInputPort],
  outputs: [valueOutputPort]
};

export const longLabelCard: NodeCardView = {
  id: "shader_with_long_label_1",
  label: "Fullscreen Shader With A Long Artist Facing Label",
  kind: "render.fullscreen-shader.with-very-long-kind-name",
  kindVersion: "0.2.0",
  typeBadgeLabel: "render.frame",
  accentColor: "#d6336c",
  inputs: [
    {
      ...valueInputPort,
      id: "artist_controlled_uniform_gain_input",
      label: "artist_controlled_uniform_gain_input"
    }
  ],
  outputs: [
    {
      ...renderFrameOutputPort,
      id: "render_frame_output_with_long_name",
      label: "render_frame_output_with_long_name"
    }
  ]
};

export const feedbackPortCard: NodeCardView = {
  id: "feedback_1",
  label: "Previous Frame",
  kind: "render.previous-frame-feedback",
  kindVersion: "0.2.0",
  typeBadgeLabel: "feedback",
  accentColor: "#d6336c",
  inputs: [
    {
      ...renderFrameInputPort,
      id: "current",
      label: "current"
    }
  ],
  outputs: [
    {
      ...renderFrameOutputPort,
      id: "previous",
      label: "previous",
      metadata: {
        ...renderFrameOutputPort.metadata,
        rate: "frame",
        fanOutPolicy: "broadcast"
      }
    }
  ]
};

export const multiPortCard: NodeCardView = {
  id: "mixer_1",
  label: "Audio Mixer",
  kind: "audio.mix",
  kindVersion: "0.2.0",
  typeBadgeLabel: "signal",
  accentColor: "#0ca678",
  inputs: [
    {
      id: "left",
      label: "left",
      direction: "input",
      typeLabel: "signal.audio.buffer",
      color: "#0ca678",
      metadata: { rate: "audio", maxConnections: null, mergePolicy: "mix" }
    },
    {
      id: "right",
      label: "right",
      direction: "input",
      typeLabel: "signal.audio.buffer",
      color: "#0ca678",
      metadata: { rate: "audio", maxConnections: null, mergePolicy: "mix" }
    },
    eventInputPort
  ],
  outputs: [
    {
      id: "mix",
      label: "mix",
      direction: "output",
      typeLabel: "signal.audio.buffer",
      color: "#0ca678",
      metadata: { rate: "audio", fanOutPolicy: "allow" }
    },
    valueOutputPort
  ]
};

export const storyEdge: EdgeV01 = {
  from: { node: "shader_1", port: "out" },
  to: { node: "output_1", port: "in" }
};

export const storyGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "storybook-graph",
  revision: "7",
  nodes: [],
  edges: [storyEdge]
};

export const validationOk: ValidationResult<GraphDocumentV01> = {
  ok: true,
  value: storyGraph
};

export const validationFailed: ValidationResult<GraphDocumentV01> = {
  ok: false,
  errors: ["ambiguous-algebraic-loop: value cycle requires explicit feedback policy"]
};

export const semanticDiagnostics: GraphSemanticDiagnostic[] = [
  {
    code: "ambiguous-algebraic-loop",
    severity: "error",
    message: "value cycle requires explicit latch, delay, or feedback boundary"
  },
  {
    code: "fan-in-forbidden",
    severity: "warning",
    message: "render.output.in accepts a single render.frame input by default"
  }
];

export const edgeInspectorModel: EdgeInspectorModel = {
  id: "shader_1.out->output_1.in",
  source: "shader_1.out",
  target: "output_1.in",
  resolvedType: "render.frame",
  order: 0,
  enabled: true,
  adapter: null,
  feedback: null,
  styleOverride: null,
  sourcePort: null,
  targetPort: null
};

export const feedbackEdgeInspectorModel: EdgeInspectorModel = {
  ...edgeInspectorModel,
  feedback: {
    boundary: "render-frame",
    bufferMode: "previous-frame",
    maxLatencyFrames: 1
  }
};

export const runtimeInfo: RuntimeInfo = {
  name: "skenion-runtime",
  version: "0.14.0",
  apiVersion: "v0",
  capabilities: [
    "session.load",
    "session.patch",
    "session.history",
    "session.preview",
    "session.telemetry"
  ]
};

export const runtimeSession: RuntimeSessionResponse = {
  ok: true,
  loaded: true,
  graphId: "storybook-graph",
  graphRevision: "7",
  sessionRevision: 12,
  diagnostics: [],
  plan: null,
  report: null
};

export const runtimePreviewStatus: RuntimePreviewStatus = {
  ok: true,
  state: "running",
  pid: 42121,
  graphId: "storybook-graph",
  graphRevision: "7",
  sessionRevision: 12,
  previewSessionRevision: 11,
  stale: true,
  startedAt: "2026-06-17T00:00:00.000Z",
  exitedAt: null,
  exitCode: null,
  message: null,
  diagnostics: []
};

export const runtimeTelemetry: RuntimeTelemetrySnapshot = {
  schema: "skenion.runtime.telemetry",
  schemaVersion: "0.1.0",
  ok: true,
  timestamp: "2026-06-17T00:00:01.000Z",
  session: {
    loaded: true,
    graphId: "storybook-graph",
    graphRevision: "7",
    sessionRevision: 12
  },
  preview: {
    state: "running",
    pid: 42121,
    stale: true,
    graphId: "storybook-graph",
    graphRevision: "7",
    sessionRevision: 12,
    previewSessionRevision: 11
  },
  render: {
    active: true,
    backend: "metal",
    renderer: "render.fullscreen-shader",
    framesRendered: 238,
    approxFps: 59.8,
    lastFrameMs: 16.6,
    lastError: null,
    sourceNodeId: "shader_1"
  },
  process: {
    runtimeVersion: "0.14.0",
    uptimeMs: 54000
  },
  diagnostics: []
};

export const runtimeTelemetryWithRenderError: RuntimeTelemetrySnapshot = {
  ...runtimeTelemetry,
  ok: false,
  render: {
    ...runtimeTelemetry.render,
    active: false,
    lastError: "WGSL compile error: expected expression at line 24"
  },
  diagnostics: [
    {
      severity: "error",
      message: "WGSL compile error: expected expression at line 24"
    }
  ]
};

const patchEvent: GraphPatchEventV01 = {
  schema: "skenion.graph.patch.event",
  schemaVersion: "0.1.0",
  id: "event_001",
  sequence: 1,
  kind: "apply",
  patch: {
    schema: "skenion.graph.patch",
    schemaVersion: "0.1.0",
    id: "patch_001",
    baseRevision: "6",
    ops: [
      {
        op: "setNodeParam",
        nodeId: "shader_1",
        key: "source",
        value: "..."
      }
    ]
  },
  inversePatch: {
    schema: "skenion.graph.patch",
    schemaVersion: "0.1.0",
    id: "patch_001_inverse",
    baseRevision: "7",
    ops: [
      {
        op: "setNodeParam",
        nodeId: "shader_1",
        key: "source",
        value: "previous"
      }
    ]
  },
  revisionBefore: "6",
  revisionAfter: "7",
  createdAt: "2026-06-17T00:00:00.000Z"
};

export const runtimeHistory: GraphPatchHistoryV01 = {
  schema: "skenion.graph.patch.history",
  schemaVersion: "0.1.0",
  events: [patchEvent],
  undoDepth: 1,
  redoDepth: 0,
  canUndo: true,
  canRedo: false
};
