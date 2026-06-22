import { validateGraphDocument } from "@skenion/contracts";
import type {
  DataTypeV01,
  NodeDefinitionManifestV01,
  PortV01,
  ValidationResult
} from "@skenion/contracts";
import type { Connection, Edge } from "@xyflow/react";
import { defaultParamsForNodeKind } from "./clearColor";
import {
  CURRENT_CONTRACT_SCHEMA_VERSION,
  contractGraphToDisplayGraph,
  displayGraphToContractGraph,
  portSpecToGraphPort,
  type DisplayEdgeV01,
  type DisplayGraphDocumentV01,
  type DisplayGraphNodeV01
} from "./patchLibrary";
import { connectionSemanticCheck } from "./portSemantics";

export type ViewPositions = Record<string, { x: number; y: number }>;

export type GraphPatch =
  | { type: "addNode"; node: DisplayGraphNodeV01 }
  | { type: "addEdge"; edge: DisplayEdgeV01 }
  | { type: "removeEdge"; edge: DisplayEdgeV01 }
  | { type: "removeNode"; nodeId: string }
  | {
      type: "replaceNode";
      nodeId: string;
      node: DisplayGraphNodeV01;
      edgePolicy: "removeInvalidEdges";
    }
  | { type: "setNodeParam"; nodeId: string; key: string; value: unknown }
  | {
      type: "replaceNodeInterface";
      nodeId: string;
      ports: PortV01[];
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
  existingNodes: DisplayGraphNodeV01[],
  paramsOverride: Record<string, unknown> = {}
): DisplayGraphNodeV01 {
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
    ports: definition.ports.map(portSpecToGraphPort),
    ...(definition.portGroups ? { portGroups: definition.portGroups.map((group) => ({ ...group })) } : {})
  };
}

export function graphSummary(graph: DisplayGraphDocumentV01): string {
  return `${graph.nodes.length} nodes · ${graph.edges.length} edges · rev ${graph.revision}`;
}

export function validateGraph(graph: unknown): ValidationResult<DisplayGraphDocumentV01> {
  const contractResult = validateGraphDocument(graph);
  if (contractResult.ok) {
    return { ok: true, value: contractGraphToDisplayGraph(contractResult.value) };
  }
  const displayGraph = graph as DisplayGraphDocumentV01;
  if (!isDisplayGraphDocument(displayGraph)) {
    return { ok: false, errors: contractResult.errors };
  }

  const currentResult = validateGraphDocument(displayGraphToContractGraph(displayGraph));
  return currentResult.ok
    ? { ok: true, value: displayGraph }
    : { ok: false, errors: currentResult.errors };
}

export function toSkenionPatch(connection: Connection): GraphPatch | null {
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

export function edgeFromReactFlow(edge: Edge): DisplayEdgeV01 | null {
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

export function applyPatch(graph: DisplayGraphDocumentV01, patch: GraphPatch): DisplayGraphDocumentV01 {
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

export function checkConnection(graph: DisplayGraphDocumentV01, patch: GraphPatch | null): ConnectionCheck {
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
    const blockingError = result.errors.find((error) => !isAuthoringIncompleteInputError(error));
    if (!blockingError) {
      return {
        ok: true,
        message: `${typeLabel(sourcePort.type)} connected to ${typeLabel(targetPort.type)}.`
      };
    }
    return {
      ok: false,
      message: blockingError
    };
  }

  return {
    ok: true,
    message: `${typeLabel(sourcePort.type)} connected to ${typeLabel(targetPort.type)}.`
  };
}

export function isValidSkenionConnection(graph: DisplayGraphDocumentV01, connection: Connection): boolean {
  return checkConnection(graph, toSkenionPatch(connection)).ok;
}

export function findPort(graph: DisplayGraphDocumentV01, nodeId: string, portId: string): PortV01 | undefined {
  return graph.nodes.find((node) => node.id === nodeId)?.ports.find((port) => port.id === portId);
}

function isAuthoringIncompleteInputError(error: string): boolean {
  return error.startsWith("missing-required-input:");
}

function bumpRevision(revision: string): string {
  const numeric = Number.parseInt(revision, 10);
  return Number.isFinite(numeric) ? String(numeric + 1) : `${revision}.1`;
}

function clonePort(port: PortV01): PortV01 {
  return JSON.parse(JSON.stringify(port)) as PortV01;
}

function cloneGraphNode(node: DisplayGraphNodeV01): DisplayGraphNodeV01 {
  return JSON.parse(JSON.stringify(node)) as DisplayGraphNodeV01;
}

function isDisplayGraphDocument(graph: Partial<DisplayGraphDocumentV01>): graph is DisplayGraphDocumentV01 {
  return (
    graph.schema === "skenion.graph" &&
    graph.schemaVersion === CURRENT_CONTRACT_SCHEMA_VERSION &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges) &&
    typeof graph.id === "string" &&
    typeof graph.revision === "string"
  );
}

function edgeEquals(left: DisplayEdgeV01, right: DisplayEdgeV01): boolean {
  return (
    left.from.node === right.from.node &&
    left.from.port === right.from.port &&
    left.to.node === right.to.node &&
    left.to.port === right.to.port
  );
}

function edgeRemainsValidAfterNodeReplace(
  graph: DisplayGraphDocumentV01,
  replacedNodeId: string,
  edge: DisplayEdgeV01
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
  graph: DisplayGraphDocumentV01,
  replacedNodeId: string,
  edge: DisplayEdgeV01
): boolean {
  if (edge.from.node !== replacedNodeId && edge.to.node !== replacedNodeId) {
    return true;
  }

  const source = findPort(graph, edge.from.node, edge.from.port);
  const target = findPort(graph, edge.to.node, edge.to.port);
  return source?.direction === "output" && target?.direction === "input";
}
