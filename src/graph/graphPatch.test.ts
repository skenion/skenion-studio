import { describe, expect, it } from "vitest";
import { nodeRegistry } from "../data/registry";
import { sampleGraph } from "../data/sampleGraph";
import {
  applyPatch,
  createGraphNodeFromDefinition,
  type GraphPatch
} from "./skenionGraph";
import {
  acceptGraphPatchQueue,
  applyGraphPatchToLocalGraph,
  clearGraphPatchQueue,
  createGraphPatch,
  emptyGraphPatchQueue,
  enqueueGraphPatchOperation,
  graphPatchFromStudioAction,
  markGraphPatchConflict
} from "./graphPatch";

describe("graph patch model", () => {
  it("creates addNode and removeNode patch operations", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.event-log");
    const node = createGraphNodeFromDefinition(definition!, sampleGraph.nodes);

    expect(graphPatchFromStudioAction({ type: "addNode", node })).toEqual({
      op: "addNode",
      node
    });
    expect(graphPatchFromStudioAction({ type: "removeNode", nodeId: node.id })).toEqual({
      op: "removeNode",
      nodeId: node.id
    });
  });

  it("creates addEdge and removeEdge patch operations", () => {
    const edge = sampleGraph.edges[0]!;

    expect(graphPatchFromStudioAction({ type: "addEdge", edge })).toEqual({
      op: "addEdge",
      edge
    });
    expect(graphPatchFromStudioAction({ type: "removeEdge", edge })).toEqual({
      op: "removeEdge",
      edge
    });
  });

  it("creates graph patches with the runtime base revision", () => {
    const operation = graphPatchFromStudioAction({
      type: "removeEdge",
      edge: sampleGraph.edges[0]!
    });
    const patch = createGraphPatch("7", [operation], {
      id: "patch_test",
      clientId: "studio-local",
      createdAt: "2026-06-16T00:00:00.000Z",
      description: "unit test patch"
    });

    expect(patch).toMatchObject({
      schema: "skenion.graph.patch",
      schemaVersion: "0.1.0",
      id: "patch_test",
      baseRevision: "7",
      clientId: "studio-local",
      createdAt: "2026-06-16T00:00:00.000Z",
      description: "unit test patch",
      ops: [operation]
    });
  });

  it("applies accepted runtime patches to a local graph revision", () => {
    const localPatch = {
      type: "removeEdge",
      edge: sampleGraph.edges[0]!
    } satisfies GraphPatch;
    const patch = createGraphPatch(sampleGraph.revision, [
      graphPatchFromStudioAction(localPatch)
    ]);
    const graph = applyGraphPatchToLocalGraph(sampleGraph, patch, "runtime-2");

    expect(graph.revision).toBe("runtime-2");
    expect(graph.edges).toHaveLength(sampleGraph.edges.length - 1);
    expect(sampleGraph.edges).toHaveLength(5);
  });

  it("throws when local patch application fails", () => {
    const patch = createGraphPatch("stale", [
      graphPatchFromStudioAction({
        type: "removeEdge",
        edge: sampleGraph.edges[0]!
      })
    ]);

    expect(() => applyGraphPatchToLocalGraph(sampleGraph, patch, "2")).toThrow("baseRevision");
  });

  it("queues pending patch operations with the current runtime graph revision", () => {
    const operation = graphPatchFromStudioAction({
      type: "removeEdge",
      edge: sampleGraph.edges[0]!
    });
    const first = enqueueGraphPatchOperation(emptyGraphPatchQueue(), operation, "1");
    const second = enqueueGraphPatchOperation(
      first,
      graphPatchFromStudioAction({
        type: "removeNode",
        nodeId: "event_log_1"
      }),
      "2"
    );

    expect(first.baseRevision).toBe("1");
    expect(second.baseRevision).toBe("1");
    expect(second.ops).toHaveLength(2);
  });

  it("does not queue operations without a runtime graph revision", () => {
    const operation = graphPatchFromStudioAction({
      type: "removeEdge",
      edge: sampleGraph.edges[0]!
    });

    expect(enqueueGraphPatchOperation(emptyGraphPatchQueue(), operation, null)).toEqual(
      emptyGraphPatchQueue()
    );
  });

  it("keeps local graph changes independent from clearing pending patch operations", () => {
    const localPatch = {
      type: "removeEdge",
      edge: sampleGraph.edges[0]!
    } satisfies GraphPatch;
    const changedGraph = applyPatch(sampleGraph, localPatch);
    const queue = enqueueGraphPatchOperation(
      emptyGraphPatchQueue(),
      graphPatchFromStudioAction(localPatch),
      sampleGraph.revision
    );

    expect(queue.ops).toHaveLength(1);
    expect(clearGraphPatchQueue().ops).toHaveLength(0);
    expect(changedGraph.edges).toHaveLength(sampleGraph.edges.length - 1);
  });

  it("successful patch acceptance clears the queue and conflict does not", () => {
    const queue = enqueueGraphPatchOperation(
      emptyGraphPatchQueue(),
      graphPatchFromStudioAction({
        type: "removeEdge",
        edge: sampleGraph.edges[0]!
      }),
      "1"
    );
    const conflict = markGraphPatchConflict(queue, "patch baseRevision 1 does not match session graph revision 2");

    expect(acceptGraphPatchQueue()).toEqual(emptyGraphPatchQueue());
    expect(conflict.ops).toHaveLength(1);
    expect(conflict.conflict).toContain("baseRevision");
  });
});
