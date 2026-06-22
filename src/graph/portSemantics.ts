import { planConversion } from "@skenion/contracts";
import type {
  ConversionPlanV01,
  DataTypeV01,
  FanOutPolicyV01,
  FeedbackPolicyV01,
  MergePolicyV01,
  PortV01,
  TriggerModeV01
} from "@skenion/contracts";
import type { DisplayEdgeV01, DisplayGraphDocumentV01, DisplayGraphNodeV01 } from "./patchLibrary";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface PortSemantics {
  id: string;
  label: string;
  description: string | null;
  direction: "input" | "output";
  type: string;
  storedType: string;
  rate: string;
  maxConnections: number | null;
  mergePolicy: MergePolicyV01;
  fanOutPolicy: FanOutPolicyV01;
  triggerMode: TriggerModeV01;
  required: boolean;
  group: string | null;
  styleKey: string | null;
}

export interface EdgeInspectorModel {
  id: string;
  source: string;
  target: string;
  resolvedType: string;
  order: number | null;
  enabled: boolean;
  adapter: string | null;
  feedback: FeedbackPolicyV01 | null;
  styleOverride: string | null;
  sourcePort: PortSemantics | null;
  targetPort: PortSemantics | null;
  conversion: EdgeConversionPreview | null;
}

export interface EdgeConversionPreview {
  source: string;
  target: string;
  lossy: boolean;
  policies: string[];
  diagnostics: string[];
}

export interface GraphSemanticDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  edgeId?: string;
  nodeId?: string;
  portId?: string;
}

interface DisplayPortExtras {
  rate?: string;
  maxConnections?: number;
  mergePolicy?: MergePolicyV01;
  fanOutPolicy?: FanOutPolicyV01;
  triggerMode?: TriggerModeV01;
  group?: string;
  styleKey?: string;
  description?: string;
}

type AddEdgePatch = { type: "addEdge"; edge: DisplayEdgeV01 };

export function portSemanticsForPort(node: DisplayGraphNodeV01, port: PortV01): PortSemantics {
  const extras = port as PortV01 & DisplayPortExtras;
  const type = artistFacingType(node, port);
  const isInput = port.direction === "input";

  return {
    id: port.id,
    label: port.label ?? port.id,
    description: extras.description ?? null,
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
  if (type === "value.color") {
    return "#e64980";
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

export function edgeId(edge: DisplayEdgeV01): string {
  return edge.id ?? `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`;
}

export function edgeInspectorModel(graph: DisplayGraphDocumentV01, edge: DisplayEdgeV01): EdgeInspectorModel {
  const sourceNode = graph.nodes.find((node) => node.id === edge.from.node);
  const targetNode = graph.nodes.find((node) => node.id === edge.to.node);
  const sourcePort = sourceNode?.ports.find((port) => port.id === edge.from.port);
  const targetPort = targetNode?.ports.find((port) => port.id === edge.to.port);
  const sourceSemantics = sourceNode && sourcePort ? portSemanticsForPort(sourceNode, sourcePort) : null;
  const targetSemantics = targetNode && targetPort ? portSemanticsForPort(targetNode, targetPort) : null;
  const conversion = sourceNode && sourcePort && targetNode && targetPort
    ? conversionPreview(planConversion(
        semanticDataTypeForPort(sourceNode, sourcePort),
        semanticDataTypeForPort(targetNode, targetPort)
      ))
    : null;

  return {
    id: edgeId(edge),
    source: `${edge.from.node}.${edge.from.port}`,
    target: `${edge.to.node}.${edge.to.port}`,
    resolvedType: edge.resolvedType ?? sourceSemantics?.type ?? targetSemantics?.type ?? "unknown",
    order: edge.order ?? null,
    enabled: edge.enabled ?? true,
    adapter: edge.adapter ?? null,
    feedback: edge.feedback ?? null,
    styleOverride: edge.styleOverride ?? null,
    sourcePort: sourceSemantics,
    targetPort: targetSemantics,
    conversion
  };
}

export function findEdgeInspectorModel(
  graph: DisplayGraphDocumentV01,
  selectedEdgeId: string | null
): EdgeInspectorModel | null {
  if (!selectedEdgeId) {
    return null;
  }

  const edge = graph.edges.find((candidate) => edgeId(candidate) === selectedEdgeId);
  return edge ? edgeInspectorModel(graph, edge) : null;
}

export function analyzeGraphPortSemantics(graph: DisplayGraphDocumentV01): GraphSemanticDiagnostic[] {
  const diagnostics: GraphSemanticDiagnostic[] = [];
  const incomingByPort = new Map<string, DisplayEdgeV01[]>();

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
    const conversion = planConversion(
      semanticDataTypeForPort(source.node, source.port),
      semanticDataTypeForPort(target.node, target.port)
    );
    if (!conversion.ok) {
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
    if (cycleEdges.some((edge) => Boolean(edge.feedback))) {
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
  graph: DisplayGraphDocumentV01,
  patch: AddEdgePatch | null
): GraphSemanticDiagnostic | null {
  if (!patch || patch.type !== "addEdge") {
    return null;
  }

  const draft: DisplayGraphDocumentV01 = {
    ...graph,
    edges: [...graph.edges, patch.edge]
  };
  return analyzeGraphPortSemantics(draft).find((diagnostic) => diagnostic.severity === "error") ?? null;
}

function findNodePort(
  graph: DisplayGraphDocumentV01,
  nodeId: string,
  portId: string
): { node: DisplayGraphNodeV01; port: PortV01 } | null {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  const port = node?.ports.find((candidate) => candidate.id === portId);
  return node && port ? { node, port } : null;
}

function artistFacingType(node: DisplayGraphNodeV01, port: PortV01): string {
  if (port.type.dataKind === "render.frame") {
    return "render.frame";
  }
  if (isRenderFramePort(node, port)) {
    return "render.frame";
  }
  if (port.type.dataKind === "gpu.texture2d") {
    return "gpu.texture2d";
  }
  if (port.type.flow === "event" && port.type.dataKind === "event.bang") {
    return "event.bang";
  }
  if (port.type.flow === "event" && port.type.dataKind === "message.any") {
    return "message.any";
  }
  if (port.type.flow === "signal" && port.type.dataKind.startsWith("signal.")) {
    return port.type.dataKind;
  }
  return `${port.type.flow}.${port.type.dataKind}`;
}

function semanticDataTypeForPort(node: DisplayGraphNodeV01, port: PortV01): DataTypeV01 {
  if (artistFacingType(node, port) === "render.frame") {
    return {
      flow: "resource",
      dataKind: "render.frame"
    };
  }
  return port.type;
}

function isRenderFramePort(node: DisplayGraphNodeV01, port: PortV01): boolean {
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

function storedTypeLabel(type: DataTypeV01): string {
  return `${type.flow}<${type.dataKind}>`;
}

function conversionPreview(plan: ConversionPlanV01): EdgeConversionPreview | null {
  if (!plan.ok || plan.steps.every((step) => step.policy === "identity")) {
    return null;
  }
  return {
    source: `${plan.source.dataKind}/${plan.source.representation}`,
    target: `${plan.target.dataKind}/${plan.target.representation}`,
    lossy: plan.lossy,
    policies: plan.steps.map((step) => [
      step.policy,
      `clamp=${step.clamp}`,
      step.trunc ? `trunc=${step.trunc}` : null,
      step.quantize ? "quantize" : null,
      step.sanitize ? `sanitize=${step.sanitize}` : null
    ].filter(Boolean).join(" ")),
    diagnostics: plan.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
  };
}

function findDirectedCycles(graph: DisplayGraphDocumentV01): DisplayEdgeV01[][] {
  const adjacency = new Map<string, DisplayEdgeV01[]>();
  for (const edge of graph.edges) {
    adjacency.set(edge.from.node, [...(adjacency.get(edge.from.node) ?? []), edge]);
  }

  const cycles: DisplayEdgeV01[][] = [];
  const seen = new Set<string>();

  for (const node of graph.nodes) {
    visit(node.id, [], new Set<string>());
  }

  return cycles;

  function visit(nodeId: string, path: DisplayEdgeV01[], visiting: Set<string>) {
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
