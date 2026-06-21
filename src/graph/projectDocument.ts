import {
  createDefaultViewStateForGraph,
  migrateGraphDocumentV01ToV02,
  migrateProjectDocumentV01ToV02,
  validateGraphDocument,
  validateGraphDocumentV02,
  validateProjectDocument,
  validateProjectDocumentV02,
  validateViewState
} from "@skenion/contracts";
import type {
  CanvasNodeViewV01,
  CanvasViewportV01,
  GraphDocumentV01,
  GraphDocumentV02,
  ProjectDocumentV02,
  ViewStateV01
} from "@skenion/contracts";
import {
  graphDocumentV01ToGraphDocumentV02,
  graphDocumentV02ToDisplayGraph
} from "./patchLibrary";

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
): ProjectDocumentV02 {
  const timestamp = now.toISOString();
  return {
    schema: "skenion.project",
    schemaVersion: "0.2.0",
    id: graph.id,
    revision: graph.revision,
    metadata: {
      title: graph.id,
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    graph: graphDocumentV01ToGraphDocumentV02(graph),
    viewState: reconcileViewStateWithGraph(graph, viewState),
    patchLibrary: []
  };
}

export function createProjectDocumentFromGraphV02(
  graph: GraphDocumentV02,
  viewState?: ViewStateV01,
  now = new Date()
): ProjectDocumentV02 {
  const displayGraph = graphDocumentV02ToDisplayGraph(graph);
  const timestamp = now.toISOString();
  return {
    schema: "skenion.project",
    schemaVersion: "0.2.0",
    id: graph.id,
    revision: graph.revision,
    metadata: {
      title: graph.id,
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    graph,
    viewState: reconcileViewStateWithGraph(
      displayGraph,
      viewState ?? createViewStateFromPositions(displayGraph, {})
    ),
    patchLibrary: []
  };
}

export function activeProjectDisplayGraph(project: ProjectDocumentV02): GraphDocumentV01 {
  return graphDocumentV02ToDisplayGraph(project.graph);
}

export function replaceProjectRootGraphFromDisplay(
  project: ProjectDocumentV02,
  graph: GraphDocumentV01,
  viewState: ViewStateV01 = project.viewState
): ProjectDocumentV02 {
  return {
    ...project,
    id: graph.id,
    revision: graph.revision,
    graph: graphDocumentV01ToGraphDocumentV02(graph),
    viewState: reconcileViewStateWithGraph(graph, viewState)
  };
}

export function updateProjectViewState(
  project: ProjectDocumentV02,
  viewState: ViewStateV01
): ProjectDocumentV02 {
  const displayGraph = activeProjectDisplayGraph(project);
  return {
    ...project,
    viewState: reconcileViewStateWithGraph(displayGraph, viewState)
  };
}

export function parseGraphDocumentAsActiveProject(document: unknown): ProjectDocumentV02 {
  const v02Result = validateGraphDocumentV02(document);
  if (v02Result.ok) {
    return createProjectDocumentFromGraphV02(v02Result.value);
  }

  const legacyResult = validateGraphDocumentForLegacyImport(document);
  if (legacyResult.ok) {
    return createProjectDocumentFromGraphV02(migrateGraphDocumentV01ToV02(legacyResult.value));
  }

  throw new Error([...v02Result.errors, ...legacyResult.errors].join("; "));
}

export function parseProjectDocument(document: unknown): ProjectDocumentV02 {
  const activeResult = validateProjectDocumentV02(document);
  if (activeResult.ok) {
    return reconcileActiveProject(activeResult.value);
  }

  const legacyResult = validateProjectDocument(document);
  if (legacyResult.ok) {
    return reconcileActiveProject(migrateProjectDocumentV01ToV02(legacyResult.value));
  }

  throw new Error([...activeResult.errors, ...legacyResult.errors].join("; "));
}

export function parseViewState(document: unknown): ViewStateV01 {
  const result = validateViewState(document);
  if (!result.ok) {
    throw new Error(result.errors[0]);
  }

  return result.value;
}

function reconcileActiveProject(project: ProjectDocumentV02): ProjectDocumentV02 {
  const displayGraph = graphDocumentV02ToDisplayGraph(project.graph);
  return {
    ...project,
    viewState: reconcileViewStateWithGraph(displayGraph, project.viewState),
    patchLibrary: project.patchLibrary.map((patch) => ({
      ...patch,
      viewState: patch.viewState
        ? reconcileViewStateWithGraph(graphDocumentV02ToDisplayGraph(patch.graph), patch.viewState)
        : patch.viewState
    }))
  };
}

function validateGraphDocumentForLegacyImport(document: unknown) {
  return validateGraphDocument(document);
}
