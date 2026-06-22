import { validateGraphDocument, validateGraphDocumentV02 } from "@skenion/contracts";
import type {
  DataTypeV01,
  NodeDefinitionManifestV01,
  ValidationResult
} from "@skenion/contracts";
import type { Connection, Edge } from "@xyflow/react";
import { defaultParamsForNodeKind } from "./clearColor";
import type {
  GraphDisplayDocument,
  GraphDisplayEdge,
  GraphDisplayNode,
  GraphDisplayPort
} from "./graphDisplay";
import { graphDisplayDocumentToGraphDocumentV02 } from "./patchLibrary";
import { connectionSemanticCheck } from "./portSemantics";

export type ViewPositions = Record<string, { x: number; y: number }>;
export type {
  GraphDisplayDocument,
  GraphDisplayEdge,
  GraphDisplayNode,
  GraphDisplayPort
} from "./graphDisplay";

export type GraphEditorPatch =
  | { type: "addNode"; node: GraphDisplayNode }
  | { type: "addEdge"; edge: GraphDisplayEdge }
  | { type: "removeEdge"; edge: GraphDisplayEdge }
  | { type: "removeNode"; nodeId: string }
  | {
      type: "replaceNode";
      nodeId: string;
      node: GraphDisplayNode;
      edgePolicy: "removeInvalidEdges";
    }
  | { type: "setNodeParam"; nodeId: string; key: string; value: unknown }
  | {
      type: "replaceNodeInterface";
      nodeId: string;
      ports: GraphDisplayPort[];
      edgePolicy: "removeInvalidEdges";
    };

export interface ConnectionCheck {
  ok: boolean;
  message: string;
}

export function typeLabel(type: DataTypeV01): string {
  return `${type.flow}<${type.dataKind}>`;
}

export function typeKey(type: DataTypeV01): string {
  return `${type.flow}:${type.dataKind}:${JSON.stringify(type.format ?? null)}`;
}

export function portKey(nodeId: string, portId: string): string {
  return `${nodeId}:${portId}`;
}

export function createGraphNodeFromDefinition(
  definition: NodeDefinitionManifestV01,
  existingNodes: GraphDisplayNode[],
  paramsOverride: Record<string, unknown> = {}
): GraphDisplayNode {
  const baseId = definition.id.split(".").pop() || "node";
  let index = existingNodes.length + 1;
  let id = `${baseId}_${index}`;
  const existingIds = new Set(existingNodes.map((node) => node.id));

  while (existingIds.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }

  return {
    id,
    kind: definition.id,
    kindVersion: definition.version,
    params: {
      ...defaultParamsForNodeKind(definition.id),
      ...paramsOverride
    },
    ports: definition.ports.map((port) => ({ ...port, type: { ...port.type } }))
  };
}

export function graphSummary(graph: GraphDisplayDocument): string {
  return `${graph.nodes.length} nodes · ${graph.edges.length} edges · rev ${graph.revision}`;
}

export function validateGraph(graph: unknown): ValidationResult<GraphDisplayDocument> {
  const legacyResult = validateGraphDocument(graph);
  if (legacyResult.ok) {
    return legacyResult;
  }
  const displayGraph = graph as GraphDisplayDocument;
  if (!isDisplayGraphDocument(displayGraph)) {
    return legacyResult;
  }

  const activeResult = validateGraphDocumentV02(graphDisplayDocumentToGraphDocumentV02(displayGraph));
  return activeResult.ok
    ? { ok: true, value: displayGraph }
    : { ok: false, errors: activeResult.errors };
}

export function normalizeLegacyGraphTypes(graph: GraphDisplayDocument): GraphDisplayDocument {
  return graph;
}

export function toSkenionPatch(connection: Connection): GraphEditorPatch | null {
  if (!connection.source || !connection.sourceHandle || !connection.target || !connection.targetHandle) {
    return null;
  }

  return {
    type: "addEdge",
    edge: {
      from: {
        node: connection.source,
        port: connection.sourceHandle
      },
      to: {
        node: connection.target,
        port: connection.targetHandle
      }
    }
  };
}

export function edgeFromReactFlow(edge: Edge): GraphDisplayEdge | null {
  if (!edge.sourceHandle || !edge.targetHandle) {
    return null;
  }

  return {
    from: {
      node: edge.source,
      port: edge.sourceHandle
    },
    to: {
      node: edge.target,
      port: edge.targetHandle
    }
  };
}

export function applyPatch(
  graph: GraphDisplayDocument,
  patch: GraphEditorPatch
): GraphDisplayDocument {
  if (patch.type === "addNode") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      nodes: [...graph.nodes, patch.node]
    };
  }

  if (patch.type === "addEdge") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      edges: [...graph.edges, patch.edge]
    };
  }

  if (patch.type === "removeEdge") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      edges: graph.edges.filter(
        (edge) =>
          !(
            edge.from.node === patch.edge.from.node &&
            edge.from.port === patch.edge.from.port &&
            edge.to.node === patch.edge.to.node &&
            edge.to.port === patch.edge.to.port
          )
      )
    };
  }

  if (patch.type === "setNodeParam") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      nodes: graph.nodes.map((node) =>
        node.id === patch.nodeId
          ? {
              ...node,
              params: {
                ...node.params,
                [patch.key]: patch.value
              }
            }
          : node
      )
    };
  }

  if (patch.type === "replaceNode") {
    const nodes = graph.nodes.map((node) => (node.id === patch.nodeId ? cloneGraphNode(patch.node) : node));
    const nextGraph = {
      ...graph,
      nodes
    };

    return {
      ...nextGraph,
      revision: bumpRevision(graph.revision),
      edges: graph.edges.filter((edge) => edgeRemainsValidAfterNodeReplace(nextGraph, patch.nodeId, edge))
    };
  }

  if (patch.type === "replaceNodeInterface") {
    const nodes = graph.nodes.map((node) =>
      node.id === patch.nodeId
        ? {
            ...node,
            ports: patch.ports.map(clonePort)
          }
        : node
    );
    const nextGraph = {
      ...graph,
      nodes
    };

    return {
      ...nextGraph,
      revision: bumpRevision(graph.revision),
      edges: graph.edges.filter((edge) => edgeRemainsValidAfterInterfaceReplace(nextGraph, patch.nodeId, edge))
    };
  }

  return {
    ...graph,
    revision: bumpRevision(graph.revision),
    nodes: graph.nodes.filter((node) => node.id !== patch.nodeId),
    edges: graph.edges.filter(
      (edge) => edge.from.node !== patch.nodeId && edge.to.node !== patch.nodeId
    )
  };
}

export function checkConnection(
  graph: GraphDisplayDocument,
  patch: GraphEditorPatch | null
): ConnectionCheck {
  if (!patch || patch.type !== "addEdge") {
    return {
      ok: false,
      message: "Connection must include source and target ports."
    };
  }

  const sourcePort = findPort(graph, patch.edge.from.node, patch.edge.from.port);
  const targetPort = findPort(graph, patch.edge.to.node, patch.edge.to.port);
  if (!sourcePort || !targetPort) {
    return {
      ok: false,
      message: "Connection references a missing port."
    };
  }

  if (sourcePort.direction !== "output" || targetPort.direction !== "input") {
    return {
      ok: false,
      message: "Connections must run from an OUT port to an IN port."
    };
  }

  const semanticDiagnostic = connectionSemanticCheck(graph, patch);
  if (semanticDiagnostic) {
    return {
      ok: false,
      message: `${semanticDiagnostic.code}: ${semanticDiagnostic.message}`
    };
  }

  const draft = applyPatch(graph, patch);
  const result = validateGraph(draft);
  if (!result.ok) {
    return {
      ok: false,
      message: result.errors[0]!
    };
  }

  return {
    ok: true,
    message: `${typeLabel(sourcePort.type)} connected to ${typeLabel(targetPort.type)}.`
  };
}

export function isValidSkenionConnection(graph: GraphDisplayDocument, connection: Connection): boolean {
  return checkConnection(graph, toSkenionPatch(connection)).ok;
}

export function findPort(
  graph: GraphDisplayDocument,
  nodeId: string,
  portId: string
): GraphDisplayPort | undefined {
  return graph.nodes.find((node) => node.id === nodeId)?.ports.find((port) => port.id === portId);
}

function bumpRevision(revision: string): string {
  const numeric = Number.parseInt(revision, 10);
  return Number.isFinite(numeric) ? String(numeric + 1) : `${revision}.1`;
}

function clonePort(port: GraphDisplayPort): GraphDisplayPort {
  return JSON.parse(JSON.stringify(port)) as GraphDisplayPort;
}

function cloneGraphNode(node: GraphDisplayNode): GraphDisplayNode {
  return JSON.parse(JSON.stringify(node)) as GraphDisplayNode;
}

function isDisplayGraphDocument(graph: Partial<GraphDisplayDocument>): graph is GraphDisplayDocument {
  return (
    graph.schema === "skenion.graph" &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges) &&
    typeof graph.id === "string" &&
    typeof graph.revision === "string"
  );
}

function edgeEquals(left: GraphDisplayEdge, right: GraphDisplayEdge): boolean {
  return (
    left.from.node === right.from.node &&
    left.from.port === right.from.port &&
    left.to.node === right.to.node &&
    left.to.port === right.to.port
  );
}

function edgeRemainsValidAfterNodeReplace(
  graph: GraphDisplayDocument,
  replacedNodeId: string,
  edge: GraphDisplayEdge
): boolean {
  if (edge.from.node !== replacedNodeId && edge.to.node !== replacedNodeId) {
    return true;
  }

  const source = findPort(graph, edge.from.node, edge.from.port);
  const target = findPort(graph, edge.to.node, edge.to.port);
  if (source?.direction !== "output" || target?.direction !== "input") {
    return false;
  }

  const graphWithoutEdge = {
    ...graph,
    edges: graph.edges.filter((candidate) => !edgeEquals(candidate, edge))
  };
  return connectionSemanticCheck(graphWithoutEdge, { type: "addEdge", edge }) === null;
}

function edgeRemainsValidAfterInterfaceReplace(
  graph: GraphDisplayDocument,
  replacedNodeId: string,
  edge: GraphDisplayEdge
): boolean {
  if (edge.from.node !== replacedNodeId && edge.to.node !== replacedNodeId) {
    return true;
  }

  const source = findPort(graph, edge.from.node, edge.from.port);
  const target = findPort(graph, edge.to.node, edge.to.port);
  return source?.direction === "output" && target?.direction === "input";
}
