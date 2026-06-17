import type { DataTypeV01, EdgeV01, GraphDocumentV01, GraphNodeV01, PortV01 } from "@skenion/contracts";

export type DiagnosticSeverity = "error" | "warning" | "info";
export type MergePolicyV02 = "forbid" | "ordered-events" | "mix" | "array" | "latest" | "first" | "custom";
export type FanOutPolicyV02 = "allow" | "copy" | "reference" | "broadcast" | "forbid";
export type TriggerModeV02 = "passive" | "trigger" | "latched";

export interface PortSemanticsV02 {
  id: string;
  label: string;
  direction: "input" | "output";
  type: string;
  storedType: string;
  rate: string;
  maxConnections: number | null;
  mergePolicy: MergePolicyV02;
  fanOutPolicy: FanOutPolicyV02;
  triggerMode: TriggerModeV02;
  required: boolean;
  group: string | null;
  styleKey: string | null;
}

export interface FeedbackPolicyPreview {
  boundary: string;
  bufferMode?: string;
  maxLatencyFrames?: number;
}

export interface EdgeInspectorModel {
  id: string;
  source: string;
  target: string;
  resolvedType: string;
  order: number | null;
  enabled: boolean;
  adapter: string | null;
  feedback: FeedbackPolicyPreview | null;
  styleOverride: string | null;
  sourcePort: PortSemanticsV02 | null;
  targetPort: PortSemanticsV02 | null;
}

export interface GraphSemanticDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  edgeId?: string;
  nodeId?: string;
  portId?: string;
}

interface V02PortExtras {
  rate?: string;
  maxConnections?: number;
  mergePolicy?: MergePolicyV02;
  fanOutPolicy?: FanOutPolicyV02;
  triggerMode?: TriggerModeV02;
  group?: string;
  styleKey?: string;
}

interface V02EdgeExtras {
  id?: string;
  resolvedType?: string;
  order?: number;
  enabled?: boolean;
  adapter?: string;
  feedback?: FeedbackPolicyPreview;
  styleOverride?: string;
}

type AddEdgePatch = { type: "addEdge"; edge: EdgeV01 };

export function portSemanticsForPort(node: GraphNodeV01, port: PortV01): PortSemanticsV02 {
  const extras = port as PortV01 & V02PortExtras;
  const type = artistFacingType(node, port);
  const isInput = port.direction === "input";

  return {
    id: port.id,
    label: port.label ?? port.id,
    direction: port.direction,
    type,
    storedType: storedTypeLabel(port.type),
    rate: extras.rate ?? defaultRate(type, port),
    maxConnections: isInput ? extras.maxConnections ?? 1 : extras.maxConnections ?? null,
    mergePolicy: extras.mergePolicy ?? "forbid",
    fanOutPolicy: extras.fanOutPolicy ?? "allow",
    triggerMode: extras.triggerMode ?? (port.activation === "trigger" ? "trigger" : "passive"),
    required: port.required ?? false,
    group: extras.group ?? null,
    styleKey: extras.styleKey ?? null
  };
}

export function semanticTypeColor(type: string): string {
  if (type === "render.frame") {
    return "#d6336c";
  }
  if (type === "gpu.texture2d") {
    return "#7048e8";
  }
  if (type.startsWith("event.")) {
    return "#f08c00";
  }
  if (type.startsWith("signal.")) {
    return "#0ca678";
  }
  if (type.startsWith("stream.")) {
    return "#1c7ed6";
  }
  if (type.startsWith("resource.")) {
    return "#7950f2";
  }
  return "#495057";
}

export function edgeId(edge: EdgeV01): string {
  const extras = edge as EdgeV01 & V02EdgeExtras;
  return extras.id ?? `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`;
}

export function edgeInspectorModel(graph: GraphDocumentV01, edge: EdgeV01): EdgeInspectorModel {
  const extras = edge as EdgeV01 & V02EdgeExtras;
  const sourceNode = graph.nodes.find((node) => node.id === edge.from.node);
  const targetNode = graph.nodes.find((node) => node.id === edge.to.node);
  const sourcePort = sourceNode?.ports.find((port) => port.id === edge.from.port);
  const targetPort = targetNode?.ports.find((port) => port.id === edge.to.port);
  const sourceSemantics = sourceNode && sourcePort ? portSemanticsForPort(sourceNode, sourcePort) : null;
  const targetSemantics = targetNode && targetPort ? portSemanticsForPort(targetNode, targetPort) : null;

  return {
    id: edgeId(edge),
    source: `${edge.from.node}.${edge.from.port}`,
    target: `${edge.to.node}.${edge.to.port}`,
    resolvedType: extras.resolvedType ?? sourceSemantics?.type ?? targetSemantics?.type ?? "unknown",
    order: extras.order ?? null,
    enabled: extras.enabled ?? true,
    adapter: extras.adapter ?? null,
    feedback: extras.feedback ?? null,
    styleOverride: extras.styleOverride ?? null,
    sourcePort: sourceSemantics,
    targetPort: targetSemantics
  };
}

export function findEdgeInspectorModel(
  graph: GraphDocumentV01,
  selectedEdgeId: string | null
): EdgeInspectorModel | null {
  if (!selectedEdgeId) {
    return null;
  }

  const edge = graph.edges.find((candidate) => edgeId(candidate) === selectedEdgeId);
  return edge ? edgeInspectorModel(graph, edge) : null;
}

export function analyzeGraphPortSemantics(graph: GraphDocumentV01): GraphSemanticDiagnostic[] {
  const diagnostics: GraphSemanticDiagnostic[] = [];
  const incomingByPort = new Map<string, EdgeV01[]>();

  for (const edge of graph.edges) {
    const source = findNodePort(graph, edge.from.node, edge.from.port);
    const target = findNodePort(graph, edge.to.node, edge.to.port);
    const id = edgeId(edge);

    if (!source || !target) {
      diagnostics.push({
        severity: "error",
        code: "missing-edge-endpoint",
        message: `${id} references a missing port.`,
        edgeId: id
      });
      continue;
    }

    if (source.port.direction !== "output" || target.port.direction !== "input") {
      diagnostics.push({
        severity: "error",
        code: "invalid-edge-direction",
        message: `${id} must run from an outlet to an inlet.`,
        edgeId: id
      });
    }

    const sourceSemantics = portSemanticsForPort(source.node, source.port);
    const targetSemantics = portSemanticsForPort(target.node, target.port);
    if (!typesCompatible(sourceSemantics.type, targetSemantics.type)) {
      diagnostics.push({
        severity: "error",
        code: "incompatible-edge-type",
        message: `${id} connects ${sourceSemantics.type} to ${targetSemantics.type} without an explicit adapter.`,
        edgeId: id
      });
    }

    const incomingKey = `${edge.to.node}:${edge.to.port}`;
    incomingByPort.set(incomingKey, [...(incomingByPort.get(incomingKey) ?? []), edge]);
  }

  for (const [portKey, incomingEdges] of incomingByPort.entries()) {
    const [nodeId, portId] = portKey.split(":");
    const target = findNodePort(graph, nodeId!, portId!)!;
    const semantics = portSemanticsForPort(target.node, target.port);
    const maxConnections = semantics.maxConnections as number;
    if (incomingEdges.length > maxConnections || (incomingEdges.length > 1 && semantics.mergePolicy === "forbid")) {
      diagnostics.push({
        severity: "error",
        code: "fan-in-forbidden",
        message: `${target.node.id}.${target.port.id} has ${incomingEdges.length} inputs, maxConnections ${semantics.maxConnections}, mergePolicy ${semantics.mergePolicy}.`,
        nodeId: target.node.id,
        portId: target.port.id
      });
    }
  }

  const cycles = findDirectedCycles(graph);
  for (const cycleEdges of cycles) {
    if (cycleEdges.some((edge) => Boolean((edge as EdgeV01 & V02EdgeExtras).feedback))) {
      diagnostics.push({
        severity: "warning",
        code: "feedback-cycle",
        message: `Cycle ${cycleEdges.map(edgeId).join(" -> ")} is marked as explicit feedback.`
      });
      continue;
    }

    const controlOrValue = cycleEdges.every((edge) => {
      const source = findNodePort(graph, edge.from.node, edge.from.port)!;
      return ["value", "event"].includes(source.port.type.flow);
    });
    diagnostics.push({
      severity: "error",
      code: controlOrValue ? "ambiguous-algebraic-loop" : "invalid-cycle",
      message: `${cycleEdges.map(edgeId).join(" -> ")} needs an explicit feedback policy.`
    });
  }

  return diagnostics;
}

export function connectionSemanticCheck(
  graph: GraphDocumentV01,
  patch: AddEdgePatch | null
): GraphSemanticDiagnostic | null {
  if (!patch || patch.type !== "addEdge") {
    return null;
  }

  const draft: GraphDocumentV01 = {
    ...graph,
    edges: [...graph.edges, patch.edge]
  };
  return analyzeGraphPortSemantics(draft).find((diagnostic) => diagnostic.severity === "error") ?? null;
}

function findNodePort(
  graph: GraphDocumentV01,
  nodeId: string,
  portId: string
): { node: GraphNodeV01; port: PortV01 } | null {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  const port = node?.ports.find((candidate) => candidate.id === portId);
  return node && port ? { node, port } : null;
}

function artistFacingType(node: GraphNodeV01, port: PortV01): string {
  if (isRenderFramePort(node, port)) {
    return "render.frame";
  }
  if (port.type.dataKind === "gpu.texture2d") {
    return "gpu.texture2d";
  }
  if (port.type.flow === "value" && port.type.dataKind === "number.f32") {
    return "value.f32";
  }
  if (port.type.flow === "event" && port.type.dataKind === "event.bang") {
    return "event.bang";
  }
  return `${port.type.flow}.${port.type.dataKind}`;
}

function isRenderFramePort(node: GraphNodeV01, port: PortV01): boolean {
  return node.kind.startsWith("render.") && ["out", "in"].includes(port.id);
}

function defaultRate(type: string, port: PortV01): string {
  if (type === "render.frame") {
    return "render";
  }
  if (type === "gpu.texture2d") {
    return "gpu";
  }
  if (port.type.flow === "event" || port.type.flow === "value") {
    return "control";
  }
  return port.type.flow;
}

function typesCompatible(sourceType: string, targetType: string): boolean {
  return sourceType === targetType;
}

function storedTypeLabel(type: DataTypeV01): string {
  return `${type.flow}<${type.dataKind}>`;
}

function findDirectedCycles(graph: GraphDocumentV01): EdgeV01[][] {
  const adjacency = new Map<string, EdgeV01[]>();
  for (const edge of graph.edges) {
    adjacency.set(edge.from.node, [...(adjacency.get(edge.from.node) ?? []), edge]);
  }

  const cycles: EdgeV01[][] = [];
  const seen = new Set<string>();

  for (const node of graph.nodes) {
    visit(node.id, [], new Set<string>());
  }

  return cycles;

  function visit(nodeId: string, path: EdgeV01[], visiting: Set<string>) {
    if (visiting.has(nodeId)) {
      const startIndex = path.findIndex((edge) => edge.from.node === nodeId);
      const cycle = path.slice(startIndex);
      const key = cycle.map(edgeId).sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }

    visiting.add(nodeId);
    for (const edge of adjacency.get(nodeId) ?? []) {
      visit(edge.to.node, [...path, edge], new Set(visiting));
    }
  }
}
