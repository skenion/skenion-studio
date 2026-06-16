import { validateGraphDocument } from "@skenion/contracts";
import type {
  DataTypeV01,
  EdgeV01,
  GraphDocumentV01,
  GraphNodeV01,
  NodeDefinitionManifestV01,
  PortV01,
  ValidationResult
} from "@skenion/contracts";
import type { Connection, Edge } from "@xyflow/react";
import { defaultParamsForNodeKind } from "./clearColor";
import { connectionSemanticCheck } from "./portSemantics";

export type ViewPositions = Record<string, { x: number; y: number }>;

export type GraphPatch =
  | { type: "addNode"; node: GraphNodeV01 }
  | { type: "addEdge"; edge: EdgeV01 }
  | { type: "removeEdge"; edge: EdgeV01 }
  | { type: "removeNode"; nodeId: string }
  | { type: "setNodeParam"; nodeId: string; key: string; value: unknown };

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
  existingNodes: GraphNodeV01[]
): GraphNodeV01 {
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
    params: defaultParamsForNodeKind(definition.id),
    ports: definition.ports.map((port) => ({ ...port, type: { ...port.type } }))
  };
}

export function graphSummary(graph: GraphDocumentV01): string {
  return `${graph.nodes.length} nodes · ${graph.edges.length} edges · rev ${graph.revision}`;
}

export function validateGraph(graph: unknown): ValidationResult<GraphDocumentV01> {
  return validateGraphDocument(graph);
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

export function edgeFromReactFlow(edge: Edge): EdgeV01 | null {
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

export function applyPatch(graph: GraphDocumentV01, patch: GraphPatch): GraphDocumentV01 {
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

  return {
    ...graph,
    revision: bumpRevision(graph.revision),
    nodes: graph.nodes.filter((node) => node.id !== patch.nodeId),
    edges: graph.edges.filter(
      (edge) => edge.from.node !== patch.nodeId && edge.to.node !== patch.nodeId
    )
  };
}

export function checkConnection(graph: GraphDocumentV01, patch: GraphPatch | null): ConnectionCheck {
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

export function isValidSkenionConnection(graph: GraphDocumentV01, connection: Connection): boolean {
  return checkConnection(graph, toSkenionPatch(connection)).ok;
}

export function findPort(graph: GraphDocumentV01, nodeId: string, portId: string): PortV01 | undefined {
  return graph.nodes.find((node) => node.id === nodeId)?.ports.find((port) => port.id === portId);
}

function bumpRevision(revision: string): string {
  const numeric = Number.parseInt(revision, 10);
  return Number.isFinite(numeric) ? String(numeric + 1) : `${revision}.1`;
}
