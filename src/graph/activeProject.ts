import type {
  EdgeV01,
  EdgeSpecV02,
  GraphDocumentV02,
  GraphNodeV02,
  PortSpecV02,
  ProjectDocumentV02,
  ViewStateV01
} from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";
import {
  graphDocumentV02ToDisplayGraph,
  graphEdgeToEdgeSpecV02,
  graphNodeToGraphNodeV02,
  graphPortToPortSpecV02
} from "./patchLibrary";
import { reconcileViewStateWithGraph } from "./projectDocument";

export function applyActiveProjectPatches(
  project: ProjectDocumentV02,
  patches: GraphPatch[],
  viewState: ViewStateV01 = project.viewState
): ProjectDocumentV02 {
  const graph = patches.reduce((currentGraph, patch) => applyGraphPatchV02(currentGraph, patch), project.graph);
  const displayGraph = graphDocumentV02ToDisplayGraph(graph);

  return {
    ...project,
    id: graph.id,
    revision: graph.revision,
    graph,
    viewState: reconcileViewStateWithGraph(displayGraph, viewState)
  };
}

function applyGraphPatchV02(graph: GraphDocumentV02, patch: GraphPatch): GraphDocumentV02 {
  if (patch.type === "addNode") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      nodes: [...graph.nodes, graphNodeToGraphNodeV02(patch.node)]
    };
  }

  if (patch.type === "addEdge") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      edges: [...graph.edges, graphEdgeToEdgeSpecV02(patch.edge)]
    };
  }

  if (patch.type === "removeEdge") {
    return {
      ...graph,
      revision: bumpRevision(graph.revision),
      edges: graph.edges.filter((edge) => !edgeEqualsDisplay(edge, patch.edge))
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
                [patch.key]: clone(patch.value)
              }
            }
          : node
      )
    };
  }

  if (patch.type === "replaceNode") {
    const nodes = graph.nodes.map((node) =>
      node.id === patch.nodeId ? graphNodeToGraphNodeV02(patch.node) : node
    );
    const nextGraph = { ...graph, nodes };
    return {
      ...nextGraph,
      revision: bumpRevision(graph.revision),
      edges: graph.edges.filter((edge) => edgeEndpointsRemainValid(nextGraph, patch.nodeId, edge))
    };
  }

  if (patch.type === "replaceNodeInterface") {
    const nodes = graph.nodes.map((node) =>
      node.id === patch.nodeId
        ? {
            ...node,
            ports: patch.ports.map(graphPortToPortSpecV02)
          }
        : node
    );
    const nextGraph = { ...graph, nodes };
    return {
      ...nextGraph,
      revision: bumpRevision(graph.revision),
      edges: graph.edges.filter((edge) => edgeEndpointsRemainValid(nextGraph, patch.nodeId, edge))
    };
  }

  return {
    ...graph,
    revision: bumpRevision(graph.revision),
    nodes: graph.nodes.filter((node) => node.id !== patch.nodeId),
    edges: graph.edges.filter(
      (edge) => edge.source.nodeId !== patch.nodeId && edge.target.nodeId !== patch.nodeId
    )
  };
}

function edgeEndpointsRemainValid(
  graph: GraphDocumentV02,
  replacedNodeId: string,
  edge: EdgeSpecV02
): boolean {
  if (edge.source.nodeId !== replacedNodeId && edge.target.nodeId !== replacedNodeId) {
    return true;
  }

  const source = findPort(graph, edge.source.nodeId, edge.source.portId);
  const target = findPort(graph, edge.target.nodeId, edge.target.portId);
  return source?.direction === "output" && target?.direction === "input";
}

function findPort(graph: GraphDocumentV02, nodeId: string, portId: string): PortSpecV02 | undefined {
  return graph.nodes.find((node: GraphNodeV02) => node.id === nodeId)?.ports.find((port) => port.id === portId);
}

function edgeEqualsDisplay(edge: EdgeSpecV02, displayEdge: EdgeV01): boolean {
  return (
    edge.source.nodeId === displayEdge.from.node &&
    edge.source.portId === displayEdge.from.port &&
    edge.target.nodeId === displayEdge.to.node &&
    edge.target.portId === displayEdge.to.port
  );
}

function bumpRevision(revision: string): string {
  const numeric = Number.parseInt(revision, 10);
  return Number.isFinite(numeric) ? String(numeric + 1) : `${revision}.1`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
