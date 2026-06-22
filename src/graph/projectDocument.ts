import {
  validateGraphDocument,
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
import {
  CURRENT_CONTRACT_SCHEMA_VERSION,
  contractGraphToDisplayGraph,
  displayGraphToContractGraph,
  type DisplayGraphDocumentV01
} from "./patchLibrary";

export type ViewPositions = Record<string, { x: number; y: number }>;
export type ContractDocumentKind = "graph" | "project";
export type ContractDocumentErrorCode = "invalid-current-document" | "unsupported-schema-version";

export interface ContractDocumentDiagnostic {
  code: ContractDocumentErrorCode;
  errors: string[];
  expectedSchemaVersion: typeof CURRENT_CONTRACT_SCHEMA_VERSION;
  kind: ContractDocumentKind;
  message: string;
  schemaVersion: string;
  severity: "error";
}

export class ContractDocumentError extends Error {
  readonly diagnostic: ContractDocumentDiagnostic;

  constructor(diagnostic: ContractDocumentDiagnostic) {
    super(diagnostic.message);
    this.name = "ContractDocumentError";
    this.diagnostic = diagnostic;
  }
}

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
  graph: DisplayGraphDocumentV01,
  positions: ViewPositions,
  viewport?: CanvasViewportV01
): ViewStateV01 {
  const defaults = createDefaultViewStateForDisplayGraph(graph);
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
  graph: DisplayGraphDocumentV01,
  viewState: ViewStateV01
): ViewStateV01 {
  const defaults = createDefaultViewStateForDisplayGraph(graph);
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
  graph: DisplayGraphDocumentV01,
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
  graph: DisplayGraphDocumentV01,
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
  graph: DisplayGraphDocumentV01,
  viewState: ViewStateV01,
  now = new Date()
): ProjectDocumentV01 {
  const timestamp = now.toISOString();
  return {
    schema: "skenion.project",
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    id: graph.id,
    revision: graph.revision,
    metadata: {
      title: graph.id,
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp
    },
    graph: displayGraphToContractGraph(graph),
    viewState: reconcileViewStateWithGraph(graph, viewState),
    patchLibrary: []
  };
}

export function createProjectDocumentFromContractGraph(
  graph: GraphDocumentV01,
  viewState?: ViewStateV01,
  now = new Date()
): ProjectDocumentV01 {
  const displayGraph = contractGraphToDisplayGraph(graph);
  const timestamp = now.toISOString();
  return {
    schema: "skenion.project",
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
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

export function activeProjectDisplayGraph(project: ProjectDocumentV01): DisplayGraphDocumentV01 {
  return contractGraphToDisplayGraph(project.graph);
}

export function replaceProjectRootGraphFromDisplay(
  project: ProjectDocumentV01,
  graph: DisplayGraphDocumentV01,
  viewState: ViewStateV01 = project.viewState
): ProjectDocumentV01 {
  return {
    ...project,
    id: graph.id,
    revision: graph.revision,
    graph: displayGraphToContractGraph(graph),
    viewState: reconcileViewStateWithGraph(graph, viewState)
  };
}

export function updateProjectViewState(
  project: ProjectDocumentV01,
  viewState: ViewStateV01
): ProjectDocumentV01 {
  const displayGraph = activeProjectDisplayGraph(project);
  return {
    ...project,
    viewState: reconcileViewStateWithGraph(displayGraph, viewState)
  };
}

export function parseGraphDocumentAsActiveProject(document: unknown): ProjectDocumentV01 {
  const result = validateGraphDocument(document);
  if (result.ok) {
    return createProjectDocumentFromContractGraph(result.value);
  }

  throw new ContractDocumentError(contractDocumentDiagnostic("graph", document, result.errors));
}

export function parseProjectDocument(document: unknown): ProjectDocumentV01 {
  const result = validateProjectDocument(document);
  if (result.ok) {
    return reconcileActiveProject(result.value);
  }

  throw new ContractDocumentError(contractDocumentDiagnostic("project", document, result.errors));
}

export function parseViewState(document: unknown): ViewStateV01 {
  const result = validateViewState(document);
  if (!result.ok) {
    throw new Error(result.errors[0]);
  }

  return result.value;
}

function reconcileActiveProject(project: ProjectDocumentV01): ProjectDocumentV01 {
  const displayGraph = contractGraphToDisplayGraph(project.graph);
  return {
    ...project,
    viewState: reconcileViewStateWithGraph(displayGraph, project.viewState),
    patchLibrary: project.patchLibrary.map((patch) => ({
      ...patch,
      viewState: patch.viewState
        ? reconcileViewStateWithGraph(contractGraphToDisplayGraph(patch.graph), patch.viewState)
        : patch.viewState
    }))
  };
}

function createDefaultViewStateForDisplayGraph(graph: DisplayGraphDocumentV01): ViewStateV01 {
  return {
    schema: "skenion.view-state",
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    canvas: {
      nodes: Object.fromEntries(
        graph.nodes.map((node, index) => [
          node.id,
          {
            x: 96 + (index % 4) * 280,
            y: 96 + Math.floor(index / 4) * 180
          }
        ])
      ),
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  };
}

function contractDocumentDiagnostic(
  kind: ContractDocumentKind,
  document: unknown,
  errors: string[]
): ContractDocumentDiagnostic {
  const version = isRecord(document) && typeof document.schemaVersion === "string"
    ? document.schemaVersion
    : "unknown";
  const code: ContractDocumentErrorCode =
    version !== CURRENT_CONTRACT_SCHEMA_VERSION ? "unsupported-schema-version" : "invalid-current-document";
  const prefix =
    code === "unsupported-schema-version"
      ? `Unsupported ${kind} schemaVersion ${version}; expected ${CURRENT_CONTRACT_SCHEMA_VERSION}.`
      : `Invalid current ${kind} document.`;
  return {
    code,
    errors,
    expectedSchemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    kind,
    message: [prefix, ...errors].join(" "),
    schemaVersion: version,
    severity: "error"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
