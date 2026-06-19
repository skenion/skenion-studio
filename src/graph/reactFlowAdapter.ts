import type { CSSProperties } from "react";
import type {
  DataFlow,
  EdgeV01,
  GraphDocumentV01,
  GraphNodeV01,
  ViewStateV01
} from "@skenion/contracts";
import { MarkerType, type Edge, type Node } from "@xyflow/react";
import { typeKey } from "./skenionGraph";
import { viewPositionsFromViewState } from "./projectDocument";
import {
  edgeInspectorModel,
  semanticTypeColor,
  portSemanticsForPort,
  type EdgeInspectorModel
} from "./portSemantics";
import { toNodeCardView } from "./nodeCardView";
import type { NodeCardView } from "../components/node/nodeTypes";
import type { RuntimeControlMessage, RuntimeControlValue } from "../runtime/types";

export interface SkenionNodeData extends Record<string, unknown> {
  card: NodeCardView;
  node: GraphNodeV01;
  label: string;
  kind: string;
  kindVersion: string;
  layoutEditable?: boolean;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  primaryFlow: DataFlow;
  runtimeControlEnabled?: boolean;
  runtimeControlPulseKey?: number;
  runtimeControlValue?: RuntimeControlValue;
}

export interface SkenionEdgeData extends Record<string, unknown> {
  inspector: EdgeInspectorModel;
  typeKey: string;
}

export interface ReactFlowViewModel {
  nodes: Array<Node<SkenionNodeData>>;
  edges: Edge[];
}

export function toReactFlowViewModel(
  graph: GraphDocumentV01,
  viewState: ViewStateV01
): ReactFlowViewModel {
  const positions = viewPositionsFromViewState(viewState);
  return {
    nodes: graph.nodes.map((node, index) =>
      toReactFlowNode(node, index, positions[node.id])
    ),
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
      card: toNodeCardView(node),
      node,
      label: String(node.params.label ?? node.id),
      kind: node.kind,
      kindVersion: node.kindVersion,
      primaryFlow: primaryPort?.type.flow ?? "value"
    }
  };
}

function toReactFlowEdge(edge: EdgeV01, graph: GraphDocumentV01): Edge {
  const sourceNode = graph.nodes.find((node) => node.id === edge.from.node);
  const sourcePort = sourceNode?.ports.find((port) => port.id === edge.from.port);
  const inspector = edgeInspectorModel(graph, edge);
  const color = sourcePort && sourceNode ? semanticTypeColor(portSemanticsForPort(sourceNode, sourcePort).type) : "#868e96";
  const label = inspector.resolvedType === "unknown" ? "" : inspector.resolvedType;
  const feedback = Boolean(inspector.feedback);
  const strokeWidth = label === "gpu.texture2d" || label === "render.frame" ? 3 : 2;

  return {
    id: inspector.id,
    source: edge.from.node,
    sourceHandle: edge.from.port,
    target: edge.to.node,
    targetHandle: edge.to.port,
    type: "smoothstep",
    label,
    interactionWidth: 18,
    animated: feedback || sourcePort?.type.flow === "event" || sourcePort?.type.flow === "stream",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color
    },
    markerStart: feedback
      ? {
          type: MarkerType.ArrowClosed,
          color
        }
      : undefined,
    style: {
      stroke: color,
      strokeDasharray: feedback ? "7 4" : undefined,
      strokeWidth,
      "--skenion-selected-edge-stroke-width": `${strokeWidth + 0.75}px`
    } as CSSProperties,
    labelStyle: {
      fill: "#343a40",
      fontWeight: 600
    },
    data: {
      inspector,
      typeKey: sourcePort ? typeKey(sourcePort.type) : ""
    }
  };
}
