import { describe, expect, it } from "vitest";
import { nodeRegistry } from "../data/registry";
import { sampleGraph, shaderUniformSampleGraph } from "../data/sampleGraph";
import {
  applyPatch,
  createGraphNodeFromDefinition,
  type GraphPatch
} from "./skenionGraph";
import { UNRESOLVED_OBJECT_NODE_KIND } from "./objectTextNode";
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
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.message");
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

  it("creates setNodeParam patch operations", () => {
    expect(
      graphPatchFromStudioAction({
        type: "setNodeParam",
        nodeId: "clear_1",
        key: "color",
        value: [0.8, 0.1, 0.2, 1]
      })
    ).toEqual({
      op: "setNodeParam",
      nodeId: "clear_1",
      key: "color",
      value: [0.8, 0.1, 0.2, 1]
    });
  });

  it("creates replaceNodeInterface patch operations and removes invalid local edges", () => {
    const outOnly = shaderUniformSampleGraph.nodes
      .find((node) => node.id === "shader_1")!
      .ports.filter((port) => port.id === "out");
    const localPatch = {
      type: "replaceNodeInterface",
      nodeId: "shader_1",
      ports: outOnly,
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const nextGraph = applyPatch(shaderUniformSampleGraph, localPatch);

    expect(graphPatchFromStudioAction(localPatch)).toEqual({
      op: "replaceNodeInterface",
      nodeId: "shader_1",
      ports: outOnly,
      edgePolicy: "removeInvalidEdges"
    });
    expect(nextGraph.nodes.find((node) => node.id === "shader_1")?.ports.map((port) => port.id)).toEqual(["out"]);
    expect(nextGraph.edges).toEqual([shaderUniformSampleGraph.edges[1]]);
    expect(shaderUniformSampleGraph.edges).toHaveLength(2);

    const targetNode = sampleGraph.nodes.find((node) => node.id === "target_1")!;
    const targetPatch = {
      type: "replaceNodeInterface",
      nodeId: "target_1",
      ports: targetNode.ports,
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const nextSampleGraph = applyPatch(sampleGraph, targetPatch);
    expect(nextSampleGraph.edges).toHaveLength(sampleGraph.edges.length);
  });

  it("creates replaceNode patch operations and keeps only valid incident edges", () => {
    const decode = sampleGraph.nodes.find((node) => node.id === "decode_1")!;
    const replacement = {
      ...decode,
      params: {
        objectText: "decode"
      }
    };
    const replacePatch = {
      type: "replaceNode",
      nodeId: "decode_1",
      node: replacement,
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const replaced = applyPatch(sampleGraph, replacePatch);

    expect(graphPatchFromStudioAction(replacePatch)).toEqual({
      op: "replaceNode",
      nodeId: "decode_1",
      node: replacement,
      edgePolicy: "removeInvalidEdges"
    });
    expect(replaced.nodes.find((node) => node.id === "decode_1")).toMatchObject({
      kind: "core.video-decode",
      params: {
        objectText: "decode"
      }
    });
    expect(replaced.edges).toHaveLength(sampleGraph.edges.length);

    const unresolvedPatch = {
      type: "replaceNode",
      nodeId: "decode_1",
      node: {
        id: "decode_1",
        kind: UNRESOLVED_OBJECT_NODE_KIND,
        kindVersion: "0.1.0",
        params: {
          objectText: "nope",
          diagnosticMessage: "nope is unavailable",
          requestedKind: "nope"
        },
        ports: []
      },
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const unresolved = applyPatch(sampleGraph, unresolvedPatch);

    expect(unresolved.nodes.find((node) => node.id === "decode_1")?.kind).toBe(UNRESOLVED_OBJECT_NODE_KIND);
    expect(unresolved.edges.some((edge) => edge.from.node === "decode_1" || edge.to.node === "decode_1")).toBe(false);
    expect(unresolved.edges).toHaveLength(sampleGraph.edges.length - 2);
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
