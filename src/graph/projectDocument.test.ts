import { describe, expect, it } from "vitest";
import type { ProjectDocumentV01, ViewStateV01 } from "@skenion/contracts";
import { sampleGraph } from "../data/sampleGraph";
import { displayGraphToContractGraph } from "./patchLibrary";
import {
  activeProjectDisplayGraph,
  ContractDocumentError,
  createProjectDocument,
  createViewStateFromPositions,
  parseGraphDocumentAsActiveProject,
  parseProjectDocument,
  parseViewState,
  reconcileViewStateWithGraph,
  replaceProjectRootGraphFromDisplay,
  updateProjectViewState,
  updateViewStateNodePosition,
  updateViewStateViewport,
  viewPositionsFromViewState
} from "./projectDocument";

describe("project document helpers", () => {
  it("creates view state from explicit positions and default positions", () => {
    const viewState = createViewStateFromPositions(
      sampleGraph,
      {
        value_1: { x: 10, y: 20 }
      },
      { x: -40, y: 12, zoom: 0.85 }
    );

    expect(viewState).toMatchObject({
      schema: "skenion.view-state",
      schemaVersion: "0.1.0",
      canvas: {
        viewport: { x: -40, y: 12, zoom: 0.85 }
      }
    });
    expect(viewPositionsFromViewState(viewState).value_1).toEqual({ x: 10, y: 20 });
    expect(viewState.canvas.nodes.target_1).toEqual({
      x: 376,
      y: 96
    });
    expect(Object.keys(viewState.canvas.nodes)).toHaveLength(sampleGraph.nodes.length);
  });

  it("reconciles view state with the current graph", () => {
    const viewState = createViewStateFromPositions(sampleGraph, {
      value_1: { x: 100, y: 200 }
    });
    const nextGraph = {
      ...sampleGraph,
      nodes: [sampleGraph.nodes[0]],
      edges: []
    };
    const reconciled = reconcileViewStateWithGraph(nextGraph, {
      ...viewState,
      canvas: {
        ...viewState.canvas,
        nodes: {
          ...viewState.canvas.nodes,
          stale: { x: 1, y: 2 }
        }
      }
    });

    expect(Object.keys(reconciled.canvas.nodes)).toEqual(["value_1"]);
    expect(reconciled.canvas.nodes.value_1).toEqual({ x: 100, y: 200 });
  });

  it("creates defaults when a view state has no viewport or node entries", () => {
    const partialViewState = {
      schema: "skenion.view-state",
      schemaVersion: "0.1.0",
      canvas: {
        nodes: {}
      }
    } as ViewStateV01;

    const reconciled = reconcileViewStateWithGraph(sampleGraph, partialViewState);

    expect(reconciled.canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(Object.keys(reconciled.canvas.nodes)).toHaveLength(sampleGraph.nodes.length);
  });

  it("updates node position and viewport without mutating the graph", () => {
    const graphBefore = JSON.stringify(sampleGraph);
    const viewState = createViewStateFromPositions(sampleGraph, {});
    const moved = updateViewStateNodePosition(sampleGraph, viewState, "value_1", { x: 480, y: 320 });
    const panned = updateViewStateViewport(sampleGraph, moved, { x: -128, y: -64, zoom: 1.25 });

    expect(viewPositionsFromViewState(panned).value_1).toEqual({ x: 480, y: 320 });
    expect(panned.canvas.viewport).toEqual({ x: -128, y: -64, zoom: 1.25 });
    expect(JSON.stringify(sampleGraph)).toBe(graphBefore);
  });

  it("serializes and parses a full project document", () => {
    const viewState = createViewStateFromPositions(sampleGraph, {
      value_1: { x: 32, y: 48 }
    });
    const project = createProjectDocument(sampleGraph, viewState, new Date("2026-06-17T00:00:00.000Z"));
    const parsed = parseProjectDocument(project);

    expect(project).toMatchObject({
      schema: "skenion.project",
      schemaVersion: "0.1.0",
      id: sampleGraph.id,
      revision: sampleGraph.revision,
      metadata: {
        title: sampleGraph.id,
        description: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z"
      },
      patchLibrary: []
    });
    expect(project.graph.schemaVersion).toBe("0.1.0");
    expect(parsed.graph).toEqual(project.graph);
    expectDisplayGraphMatchesSample(activeProjectDisplayGraph(parsed));
    expect(parsed.viewState.canvas.nodes.value_1).toEqual({ x: 32, y: 48 });
  });

  it("accepts current 0.1 project documents without migration", () => {
    const viewState = createViewStateFromPositions(sampleGraph, {
      value_1: { x: 32, y: 48 }
    });
    const project = {
      schema: "skenion.project",
      schemaVersion: "0.1.0",
      id: sampleGraph.id,
      revision: sampleGraph.revision,
      metadata: {
        title: "Legacy Project",
        description: "",
        createdAt: "2026-06-17T00:00:00.000Z",
        updatedAt: "2026-06-17T00:00:00.000Z"
      },
      graph: displayGraphToContractGraph(sampleGraph),
      viewState,
      patchLibrary: []
    } satisfies ProjectDocumentV01;
    const parsed = parseProjectDocument(project);

    expect(parsed.schemaVersion).toBe("0.1.0");
    expect(parsed.metadata?.title).toBe("Legacy Project");
    expect(parsed.graph.schemaVersion).toBe("0.1.0");
    expect(parsed.patchLibrary).toEqual([]);
    expectDisplayGraphMatchesSample(activeProjectDisplayGraph(parsed));
    expect(parsed.viewState.canvas.nodes.value_1).toEqual({ x: 32, y: 48 });
  });

  it("imports current 0.1 graph files as current 0.1 project documents", () => {
    const project = parseGraphDocumentAsActiveProject(displayGraphToContractGraph(sampleGraph));

    expect(project.schemaVersion).toBe("0.1.0");
    expect(project.graph.schemaVersion).toBe("0.1.0");
    expect(project.patchLibrary).toEqual([]);
    expectDisplayGraphMatchesSample(activeProjectDisplayGraph(project));
  });

  it("imports active current 0.1 graph files as current 0.1 project documents", () => {
    const activeGraph = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {})).graph;
    const project = parseGraphDocumentAsActiveProject(activeGraph);

    expect(project.schemaVersion).toBe("0.1.0");
    expect(project.graph).toEqual(activeGraph);
    expect(project.viewState.canvas.nodes.value_1).toEqual({ x: 96, y: 96 });
  });

  it("updates active project view state against the current 0.1 display adapter", () => {
    const project = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const updated = updateProjectViewState(project, {
      ...project.viewState,
      canvas: {
        ...project.viewState.canvas,
        nodes: {
          ...project.viewState.canvas.nodes,
          value_1: { x: 11, y: 12 }
        }
      }
    });

    expect(updated.schemaVersion).toBe("0.1.0");
    expect(updated.viewState.canvas.nodes.value_1).toEqual({ x: 11, y: 12 });
  });

  it("replaces an active project root graph from the display adapter boundary", () => {
    const project = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const displayGraph = {
      ...activeProjectDisplayGraph(project),
      id: "replacement",
      revision: "9",
      nodes: activeProjectDisplayGraph(project).nodes.slice(0, 1),
      edges: []
    };
    const replaced = replaceProjectRootGraphFromDisplay(project, displayGraph);

    expect(replaced.id).toBe("replacement");
    expect(replaced.revision).toBe("9");
    expect(replaced.graph.schemaVersion).toBe("0.1.0");
    expect(replaced.viewState.canvas.nodes.value_1).toBeDefined();
    expect(replaced.viewState.canvas.nodes.target_1).toBeUndefined();
  });

  it("reconciles active project patch library view states", () => {
    const project = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const patchGraph = {
      ...project.graph,
      id: "patch-graph",
      nodes: [project.graph.nodes[0]],
      edges: []
    };
    const parsed = parseProjectDocument({
      ...project,
      patchLibrary: [
        {
          id: "with-view",
          revision: "1",
          graph: patchGraph,
          viewState: {
            schema: "skenion.view-state",
            schemaVersion: "0.1.0",
            canvas: {
              nodes: { value_1: { x: 3, y: 4 } },
              viewport: { x: 0, y: 0, zoom: 1 }
            }
          }
        },
        {
          id: "without-view",
          revision: "1",
          graph: patchGraph
        }
      ]
    });

    expect(parsed.patchLibrary[0]?.viewState?.canvas.nodes.value_1).toEqual({ x: 3, y: 4 });
    expect(parsed.patchLibrary[1]?.viewState).toBeUndefined();
  });

  it("rejects documents that are not current graphs or projects", () => {
    expect(() => parseGraphDocumentAsActiveProject({ schema: "wrong" })).toThrow();
    expect(() => parseProjectDocument({ schema: "wrong" })).toThrow();
  });

  it("rejects unsupported versions and old display-shape imports", () => {
    expect(() =>
      parseGraphDocumentAsActiveProject({
        ...displayGraphToContractGraph(sampleGraph),
        schemaVersion: "0.2.0"
      })
    ).toThrow("Unsupported graph schemaVersion 0.2.0; expected 0.1.0.");
    expect(() => parseGraphDocumentAsActiveProject(sampleGraph)).toThrow();
    expect(() =>
      parseProjectDocument({
        ...createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {})),
        schemaVersion: "0.2.0"
      })
    ).toThrow("Unsupported project schemaVersion 0.2.0; expected 0.1.0.");
  });

  it("throws structured diagnostics for unsupported contract versions", () => {
    try {
      parseGraphDocumentAsActiveProject({
        ...displayGraphToContractGraph(sampleGraph),
        schemaVersion: "0.2.0"
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ContractDocumentError);
      expect((error as ContractDocumentError).diagnostic).toMatchObject({
        code: "unsupported-schema-version",
        expectedSchemaVersion: "0.1.0",
        kind: "graph",
        schemaVersion: "0.2.0",
        severity: "error"
      });
      return;
    }
    throw new Error("Expected unsupported graph version to throw.");
  });

  it("validates standalone view state documents", () => {
    const viewState = createViewStateFromPositions(sampleGraph, {});

    expect(parseViewState(viewState)).toEqual(viewState);
    expect(() =>
      parseViewState({
        schema: "skenion.view-state",
        schemaVersion: "0.1.0",
        canvas: {
          nodes: {
            value_1: { x: "wrong", y: 12 }
          }
        }
      })
    ).toThrow("/canvas/nodes/value_1/x must be number");
  });

  it("rejects project documents whose view state references missing nodes", () => {
    const viewState = createViewStateFromPositions(sampleGraph, {});
    const invalidProject = {
      ...createProjectDocument(sampleGraph, viewState),
      viewState: {
        ...viewState,
        canvas: {
          ...viewState.canvas,
          nodes: {
            ...viewState.canvas.nodes,
            missing: { x: 0, y: 0 }
          }
        }
      }
    } satisfies ProjectDocumentV01;

    expect(() => parseProjectDocument(invalidProject)).toThrow("viewState references missing graph node: missing");
  });
});

function expectDisplayGraphMatchesSample(displayGraph: typeof sampleGraph) {
  expect(displayGraph.schema).toBe("skenion.graph");
  expect(displayGraph.schemaVersion).toBe("0.1.0");
  expect(displayGraph.id).toBe(sampleGraph.id);
  expect(displayGraph.revision).toBe(sampleGraph.revision);
  expect(displayGraph.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    params: node.params
  }))).toEqual(sampleGraph.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    params: node.params
  })));
  expect(displayGraph.edges.map((edge) => ({ from: edge.from, to: edge.to }))).toEqual(sampleGraph.edges);
}
