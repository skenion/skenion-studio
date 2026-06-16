import type {
  DataFlow,
  EdgeV01,
  GraphDocumentV01,
  GraphNodeV01,
  PortV01
} from "@skenion/contracts";
import type { Edge, Node } from "@xyflow/react";
import { typeKey, typeLabel, type ViewPositions } from "./skenionGraph";

export interface SkenionNodeData extends Record<string, unknown> {
  label: string;
  kind: string;
  kindVersion: string;
  ports: PortV01[];
  primaryFlow: DataFlow;
}

export interface ReactFlowViewModel {
  nodes: Array<Node<SkenionNodeData>>;
  edges: Edge[];
}

export function toReactFlowViewModel(
  graph: GraphDocumentV01,
  positions: ViewPositions
): ReactFlowViewModel {
  return {
    nodes: graph.nodes.map((node, index) => toReactFlowNode(node, index, positions[node.id])),
    edges: graph.edges.map((edge) => toReactFlowEdge(edge, graph))
  };
}

export function defaultPosition(index: number): { x: number; y: number } {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 64 + column * 300,
    y: 72 + row * 180
  };
}

export function flowColor(flow: DataFlow, dataKind?: string): string {
  if (dataKind === "gpu.texture2d") {
    return "#7048e8";
  }

  switch (flow) {
    case "event":
      return "#f08c00";
    case "signal":
      return "#0ca678";
    case "stream":
      return "#1c7ed6";
    case "resource":
      return "#7950f2";
    case "value":
      return "#495057";
  }
}

export function flowName(flow: DataFlow, dataKind?: string): string {
  if (dataKind === "gpu.texture2d") {
    return "gpu resource";
  }

  return flow;
}

function toReactFlowNode(
  node: GraphNodeV01,
  index: number,
  position?: { x: number; y: number }
): Node<SkenionNodeData> {
  const outputPort = node.ports.find((port) => port.direction === "output");
  const inputPort = node.ports.find((port) => port.direction === "input");
  const primaryPort = outputPort ?? inputPort ?? node.ports[0];

  return {
    id: node.id,
    type: "skenion",
    position: position ?? defaultPosition(index),
    data: {
      label: String(node.params.label ?? node.id),
      kind: node.kind,
      kindVersion: node.kindVersion,
      ports: node.ports,
      primaryFlow: primaryPort?.type.flow ?? "value"
    }
  };
}

function toReactFlowEdge(edge: EdgeV01, graph: GraphDocumentV01): Edge {
  const sourcePort = graph.nodes
    .find((node) => node.id === edge.from.node)
    ?.ports.find((port) => port.id === edge.from.port);
  const color = sourcePort ? flowColor(sourcePort.type.flow, sourcePort.type.dataKind) : "#868e96";
  const label = sourcePort ? typeLabel(sourcePort.type) : "";

  return {
    id: `${edge.from.node}.${edge.from.port}->${edge.to.node}.${edge.to.port}`,
    source: edge.from.node,
    sourceHandle: edge.from.port,
    target: edge.to.node,
    targetHandle: edge.to.port,
    type: "smoothstep",
    label,
    interactionWidth: 18,
    animated: sourcePort?.type.flow === "event" || sourcePort?.type.flow === "stream",
    style: {
      stroke: color,
      strokeWidth: sourcePort?.type.dataKind === "gpu.texture2d" ? 3 : 2
    },
    labelStyle: {
      fill: "#343a40",
      fontWeight: 600
    },
    data: {
      typeKey: sourcePort ? typeKey(sourcePort.type) : ""
    }
  };
}
