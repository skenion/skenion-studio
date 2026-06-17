import { describe, expect, it } from "vitest";
import type { ProjectDocumentV01, ViewStateV01 } from "@skenion/contracts";
import { sampleGraph } from "../data/sampleGraph";
import {
  createProjectDocument,
  createViewStateFromPositions,
  parseProjectDocument,
  parseViewState,
  reconcileViewStateWithGraph,
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
      }
    });
    expect(parsed.graph).toEqual(sampleGraph);
    expect(parsed.viewState.canvas.nodes.value_1).toEqual({ x: 32, y: 48 });
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
