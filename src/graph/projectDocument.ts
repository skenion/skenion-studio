import {
  createDefaultViewStateForGraph,
  validateProjectDocument,
  validateViewState
} from "@skenion/contracts";
import type {
  CanvasNodeViewV01,
  CanvasViewportV01,
  GraphDocumentV01,
  ProjectDocumentV01,
  ViewStateV01
} from "@skenion/contracts";

export type ViewPositions = Record<string, { x: number; y: number }>;

export function viewPositionsFromViewState(viewState: ViewStateV01): ViewPositions {
  return Object.fromEntries(
    Object.entries(viewState.canvas.nodes).map(([nodeId, nodeView]) => [
      nodeId,
      {
        x: nodeView.x,
        y: nodeView.y
      }
    ])
  );
}

export function createViewStateFromPositions(
  graph: GraphDocumentV01,
  positions: ViewPositions,
  viewport?: CanvasViewportV01
): ViewStateV01 {
  const defaults = createDefaultViewStateForGraph(graph);
  const nodes = Object.fromEntries(
    graph.nodes.map((node) => [
      node.id,
      {
        ...defaults.canvas.nodes[node.id],
        ...positions[node.id]
      }
    ])
  ) as Record<string, CanvasNodeViewV01>;

  return {
    ...defaults,
    canvas: {
      nodes,
      viewport: viewport ?? defaults.canvas.viewport
    }
  };
}

export function reconcileViewStateWithGraph(
  graph: GraphDocumentV01,
  viewState: ViewStateV01
): ViewStateV01 {
  const defaults = createDefaultViewStateForGraph(graph);
  const nodes = Object.fromEntries(
    graph.nodes.map((node) => [
      node.id,
      {
        ...defaults.canvas.nodes[node.id],
        ...viewState.canvas.nodes[node.id]
      }
    ])
  ) as Record<string, CanvasNodeViewV01>;

  return {
    schema: "skenion.view-state",
    schemaVersion: "0.1.0",
    canvas: {
      nodes,
      viewport: viewState.canvas.viewport ?? defaults.canvas.viewport
    }
  };
}

export function updateViewStateNodePosition(
  graph: GraphDocumentV01,
  viewState: ViewStateV01,
  nodeId: string,
  position: { x: number; y: number }
): ViewStateV01 {
  return reconcileViewStateWithGraph(graph, {
    ...viewState,
    canvas: {
      ...viewState.canvas,
      nodes: {
        ...viewState.canvas.nodes,
        [nodeId]: {
          ...viewState.canvas.nodes[nodeId],
          ...position
        }
      }
    }
  });
}

export function updateViewStateViewport(
  graph: GraphDocumentV01,
  viewState: ViewStateV01,
  viewport: CanvasViewportV01
): ViewStateV01 {
  return reconcileViewStateWithGraph(graph, {
    ...viewState,
    canvas: {
      ...viewState.canvas,
      viewport
    }
  });
}

export function createProjectDocument(
  graph: GraphDocumentV01,
  viewState: ViewStateV01,
  now = new Date()
): ProjectDocumentV01 {
  const timestamp = now.toISOString();
  return {
    schema: "skenion.project",
    schemaVersion: "0.1.0",
    id: graph.id,
    revision: graph.revision,
    metadata: {
      title: graph.id,
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    graph,
    viewState: reconcileViewStateWithGraph(graph, viewState)
  };
}

export function parseProjectDocument(document: unknown): ProjectDocumentV01 {
  const result = validateProjectDocument(document);
  if (!result.ok) {
    throw new Error(result.errors[0]);
  }

  return {
    ...result.value,
    viewState: reconcileViewStateWithGraph(result.value.graph, result.value.viewState)
  };
}

export function parseViewState(document: unknown): ViewStateV01 {
  const result = validateViewState(document);
  if (!result.ok) {
    throw new Error(result.errors[0]);
  }

  return result.value;
}
