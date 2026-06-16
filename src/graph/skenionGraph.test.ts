import { describe, expect, it } from "vitest";
import type { Connection, Edge } from "@xyflow/react";
import { nodeRegistry } from "../data/registry";
import { renderSampleGraph, sampleGraph, shaderUniformSampleGraph } from "../data/sampleGraph";
import {
  applyPatch,
  checkConnection,
  createGraphNodeFromDefinition,
  edgeFromReactFlow,
  findPort,
  graphSummary,
  isValidSkenionConnection,
  portKey,
  toSkenionPatch,
  typeKey,
  typeLabel,
  validateGraph
} from "./skenionGraph";

describe("skenion graph helpers", () => {
  it("formats type and port keys", () => {
    const type = { flow: "value", dataKind: "number.f32", format: "float32" } as const;

    expect(typeLabel(type)).toBe("value<number.f32>");
    expect(typeKey(type)).toBe('value:number.f32:"float32"');
    expect(portKey("node", "out")).toBe("node:out");
  });

  it("creates unique graph nodes from node definitions", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.value-f32");
    expect(definition).toBeDefined();

    const first = createGraphNodeFromDefinition(definition!, []);
    const second = createGraphNodeFromDefinition(definition!, [first]);
    const skipped = createGraphNodeFromDefinition(definition!, [
      { ...first, id: "value-f32_2" }
    ]);
    const fallback = createGraphNodeFromDefinition({ ...definition!, id: "" }, []);

    expect(first.id).toBe("value-f32_1");
    expect(second.id).toBe("value-f32_2");
    expect(skipped.id).toBe("value-f32_3");
    expect(fallback.id).toBe("node_1");
    expect(second.ports[0]).not.toBe(definition!.ports[0]);
  });

  it("summarizes and validates graphs", () => {
    expect(graphSummary(sampleGraph)).toBe("8 nodes · 5 edges · rev 1");
    expect(validateGraph(sampleGraph).ok).toBe(true);
    expect(graphSummary(renderSampleGraph)).toBe("2 nodes · 1 edges · rev 1");
    expect(validateGraph(renderSampleGraph).ok).toBe(true);
    expect(graphSummary(shaderUniformSampleGraph)).toBe("3 nodes · 2 edges · rev 1");
    expect(validateGraph(shaderUniformSampleGraph).ok).toBe(true);
    expect(validateGraph({}).ok).toBe(false);
  });

  it("converts React Flow connections and edges to Skenion patches", () => {
    const connection = {
      source: "value_1",
      sourceHandle: "value",
      target: "target_1",
      targetHandle: "value"
    } satisfies Connection;
    const edge = {
      id: "edge",
      source: "value_1",
      sourceHandle: "value",
      target: "target_1",
      targetHandle: "value"
    } satisfies Edge;

    expect(toSkenionPatch(connection)).toEqual({
      type: "addEdge",
      edge: sampleGraph.edges[0]
    });
    expect(edgeFromReactFlow(edge)).toEqual(sampleGraph.edges[0]);
    expect(toSkenionPatch({ source: null, target: "target_1" } as unknown as Connection)).toBeNull();
    expect(edgeFromReactFlow({ ...edge, sourceHandle: null })).toBeNull();
  });

  it("applies graph patches and bumps revisions", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.event-log");
    const renderDefinition = nodeRegistry.find((candidate) => candidate.id === "render.clear-color");
    const node = createGraphNodeFromDefinition(definition!, sampleGraph.nodes);
    const renderNode = createGraphNodeFromDefinition(renderDefinition!, sampleGraph.nodes);
    const graphWithTextRevision = {
      ...sampleGraph,
      revision: "draft"
    };

    const addedNode = applyPatch(sampleGraph, { type: "addNode", node });
    const addedEdge = applyPatch(sampleGraph, { type: "addEdge", edge: sampleGraph.edges[0] });
    const removedEdge = applyPatch(sampleGraph, { type: "removeEdge", edge: sampleGraph.edges[0] });
    const removedNode = applyPatch(graphWithTextRevision, { type: "removeNode", nodeId: "value_1" });
    const changedParam = applyPatch(
      {
        ...sampleGraph,
        nodes: [...sampleGraph.nodes, renderNode]
      },
      {
        type: "setNodeParam",
        nodeId: renderNode.id,
        key: "color",
        value: [0.8, 0.1, 0.2, 1]
      }
    );

    expect(addedNode.revision).toBe("2");
    expect(addedNode.nodes.at(-1)).toEqual(node);
    expect(renderNode.params).toEqual({ color: [0.05, 0.08, 0.12, 1] });
    expect(addedEdge.edges).toHaveLength(sampleGraph.edges.length + 1);
    expect(removedEdge.edges).toHaveLength(sampleGraph.edges.length - 1);
    expect(removedNode.revision).toBe("draft.1");
    expect(removedNode.nodes.some((candidate) => candidate.id === "value_1")).toBe(false);
    expect(removedNode.edges.some((edge) => edge.from.node === "value_1" || edge.to.node === "value_1")).toBe(false);
    expect(changedParam.nodes.find((candidate) => candidate.id === renderNode.id)?.params.color).toEqual([
      0.8,
      0.1,
      0.2,
      1
    ]);
  });

  it("checks connection failures and success messages", () => {
    expect(checkConnection(sampleGraph, null)).toEqual({
      ok: false,
      message: "Connection must include source and target ports."
    });
    expect(
      checkConnection(sampleGraph, {
        type: "addEdge",
        edge: {
          from: { node: "value_1", port: "missing" },
          to: { node: "target_1", port: "value" }
        }
      })
    ).toEqual({
      ok: false,
      message: "Connection references a missing port."
    });
    expect(
      checkConnection(sampleGraph, {
        type: "addEdge",
        edge: {
          from: { node: "target_1", port: "value" },
          to: { node: "value_1", port: "value" }
        }
      })
    ).toEqual({
      ok: false,
      message: "Connections must run from an output port to an input port."
    });
    expect(
      checkConnection(sampleGraph, {
        type: "addEdge",
        edge: {
          from: { node: "value_1", port: "value" },
          to: { node: "event_log_1", port: "bang" }
        }
      }).message
    ).toMatch(/incompatible edge/);
    expect(
      checkConnection(sampleGraph, {
        type: "addEdge",
        edge: sampleGraph.edges[0]
      }).message
    ).toMatch(/fan-in-forbidden/);
    expect(
      checkConnection(
        {
          ...sampleGraph,
          edges: []
        },
        {
          type: "addEdge",
          edge: sampleGraph.edges[0]
        }
      )
    ).toEqual({
      ok: true,
      message: "value<f32> connected to value<f32>."
    });
    expect(
      isValidSkenionConnection(sampleGraph, {
        source: "value_1",
        sourceHandle: "value",
        target: "target_1",
        targetHandle: "value"
      })
    ).toBe(false);
    expect(
      isValidSkenionConnection(
        {
          ...renderSampleGraph,
          edges: []
        },
        {
          source: "shader_1",
          sourceHandle: "out",
          target: "output_1",
          targetHandle: "in"
        }
      )
    ).toBe(true);
    expect(
      checkConnection(
        {
          ...shaderUniformSampleGraph,
          edges: [shaderUniformSampleGraph.edges[1]!]
        },
        {
          type: "addEdge",
          edge: shaderUniformSampleGraph.edges[0]!
        }
      )
    ).toEqual({
      ok: true,
      message: "value<f32> connected to value<f32>."
    });
    expect(
      checkConnection(
        {
          ...shaderUniformSampleGraph,
          nodes: [
            ...shaderUniformSampleGraph.nodes,
            sampleGraph.nodes.find((node) => node.id === "bang_1")!
          ],
          edges: [shaderUniformSampleGraph.edges[1]!]
        },
        {
          type: "addEdge",
          edge: {
            from: { node: "bang_1", port: "bang" },
            to: { node: "shader_1", port: "u_value" }
          }
        }
      ).message
    ).toMatch(/incompatible edge/);
    expect(
      isValidSkenionConnection(renderSampleGraph, {
        source: "output_1",
        sourceHandle: "in",
        target: "shader_1",
        targetHandle: "out"
      })
    ).toBe(false);
  });

  it("finds graph ports", () => {
    expect(findPort(sampleGraph, "value_1", "value")?.direction).toBe("output");
    expect(findPort(sampleGraph, "value_1", "missing")).toBeUndefined();
  });
});
