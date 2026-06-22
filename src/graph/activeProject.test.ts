import { describe, expect, it } from "vitest";
import type { PatchDefinitionV01 } from "@skenion/contracts";
import { sampleGraph } from "../data/sampleGraph";
import { createProjectDocument, createViewStateFromPositions, activeProjectDisplayGraph } from "./projectDocument";
import { applyActiveProjectPatches } from "./activeProject";
import { createGraphNodeFromDefinition } from "./skenionGraph";
import { nodeRegistry } from "../data/registry";
import type { GraphPatch } from "./skenionGraph";

describe("active project graph current 0.1 mutations", () => {
  it("applies Studio graph edits to the current 0.1 project source of truth", () => {
    const project = {
      ...createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {})),
      patchLibrary: [testPatchDefinition()]
    };
    const patch = {
      type: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: 0.75
    } satisfies GraphPatch;
    const nextProject = applyActiveProjectPatches(project, [patch]);

    expect(nextProject.schemaVersion).toBe("0.1.0");
    expect(nextProject.graph.schemaVersion).toBe("0.1.0");
    expect(nextProject.graph.nodes.find((node) => node.id === "value_1")?.params.value).toBe(0.75);
    expect(nextProject.patchLibrary).toEqual(project.patchLibrary);
    expect(activeProjectDisplayGraph(nextProject).schemaVersion).toBe("0.1.0");
  });

  it("removes invalid current 0.1 edges when a node interface changes", () => {
    const project = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const patch = {
      type: "replaceNodeInterface",
      nodeId: "value_1",
      ports: [],
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const nextProject = applyActiveProjectPatches(project, [patch]);

    expect(nextProject.graph.edges.some((edge) => edge.source.nodeId === "value_1")).toBe(false);
  });

  it("applies add node, add edge, remove edge, replace node, and remove node edits", () => {
    const project = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const floatDefinition = nodeRegistry.find((definition) => definition.id === "core.float");
    if (!floatDefinition) {
      throw new Error("core.float definition missing");
    }
    const extraNode = {
      ...createGraphNodeFromDefinition(floatDefinition, sampleGraph.nodes),
      id: "extra_value"
    };
    const addNode = { type: "addNode", node: extraNode } satisfies GraphPatch;
    const addEdge = {
      type: "addEdge",
      edge: {
        from: { node: "extra_value", port: "value" },
        to: { node: "target_1", port: "in" }
      }
    } satisfies GraphPatch;
    const removeEdge = { type: "removeEdge", edge: addEdge.edge } satisfies GraphPatch;
    const replaceNode = {
      type: "replaceNode",
      nodeId: "target_1",
      node: {
        ...sampleGraph.nodes.find((node) => node.id === "target_1")!,
        ports: []
      },
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const removeNode = { type: "removeNode", nodeId: "extra_value" } satisfies GraphPatch;
    const nextProject = applyActiveProjectPatches(project, [addNode, addEdge, removeEdge, replaceNode, removeNode]);

    expect(nextProject.graph.nodes.some((node) => node.id === "extra_value")).toBe(false);
    expect(nextProject.graph.nodes.find((node) => node.id === "target_1")?.ports).toEqual([]);
    expect(nextProject.graph.edges.some((edge) => edge.target.nodeId === "target_1")).toBe(false);
    expect(nextProject.graph.edges.some((edge) => edge.source.nodeId === "decode_1")).toBe(true);
  });

  it("bumps non-numeric graph revisions without demoting the current 0.1 graph", () => {
    const project = {
      ...createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {})),
      graph: {
        ...createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {})).graph,
        revision: "rev"
      }
    };
    const nextProject = applyActiveProjectPatches(project, [
      {
        type: "setNodeParam",
        nodeId: "value_1",
        key: "value",
        value: { nested: true }
      }
    ]);

    expect(nextProject.graph.revision).toBe("rev.1");
    expect(nextProject.graph.nodes.find((node) => node.id === "value_1")?.params.value).toEqual({ nested: true });
  });
});

function testPatchDefinition(): PatchDefinitionV01 {
  return {
    id: "voice",
    revision: "1",
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "voice",
      revision: "1",
      nodes: [],
      edges: []
    }
  };
}
