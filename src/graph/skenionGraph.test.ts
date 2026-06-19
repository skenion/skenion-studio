import { describe, expect, it } from "vitest";
import type { Connection, Edge } from "@xyflow/react";
import { nodeRegistry } from "../data/registry";
import {
  portDemoSampleGraph,
  renderSampleGraph,
  sampleGraph,
  objectRoutingPanelSampleGraph,
  objectVisualSampleGraph,
  shaderMultiUniformSampleGraph,
  shaderUniformSampleGraph
} from "../data/sampleGraph";
import {
  applyPatch,
  checkConnection,
  createGraphNodeFromDefinition,
  edgeFromReactFlow,
  findPort,
  graphSummary,
  isValidSkenionConnection,
  normalizeLegacyGraphTypes,
  portKey,
  toSkenionPatch,
  typeKey,
  typeLabel,
  validateGraph
} from "./skenionGraph";

describe("skenion graph helpers", () => {
  it("formats type and port keys", () => {
    const type = { flow: "value", dataKind: "number.float", format: "float32" } as const;

    expect(typeLabel(type)).toBe("value<number.float>");
    expect(typeKey(type)).toBe('value:number.float:"float32"');
    expect(portKey("node", "out")).toBe("node:out");
  });

  it("creates unique graph nodes from node definitions", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.float");
    expect(definition).toBeDefined();

    const first = createGraphNodeFromDefinition(definition!, []);
    const second = createGraphNodeFromDefinition(definition!, [first]);
    const skipped = createGraphNodeFromDefinition(definition!, [
      { ...first, id: "float_2" }
    ]);
    const fallback = createGraphNodeFromDefinition({ ...definition!, id: "" }, []);

    expect(first.id).toBe("float_1");
    expect(second.id).toBe("float_2");
    expect(skipped.id).toBe("float_3");
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
    expect(graphSummary(shaderMultiUniformSampleGraph)).toBe("5 nodes · 4 edges · rev 1");
    expect(validateGraph(shaderMultiUniformSampleGraph).ok).toBe(true);
    expect(graphSummary(portDemoSampleGraph)).toBe("6 nodes · 3 edges · rev 1");
    expect(validateGraph(portDemoSampleGraph).ok).toBe(true);
    expect(graphSummary(objectRoutingPanelSampleGraph)).toBe("4 nodes · 3 edges · rev 1");
    expect(validateGraph(objectRoutingPanelSampleGraph).ok).toBe(true);
    expect(graphSummary(objectVisualSampleGraph)).toBe("8 nodes · 2 edges · rev 1");
    expect(validateGraph(objectVisualSampleGraph).ok).toBe(true);
    expect(validateGraph({}).ok).toBe(false);
  });

  it("does not silently normalize legacy semantic type names", () => {
    expect(normalizeLegacyGraphTypes(sampleGraph)).toBe(sampleGraph);
  });

  it("converts React Flow connections and edges to Skenion patches", () => {
    const connection = {
      source: "value_1",
      sourceHandle: "value",
      target: "target_1",
      targetHandle: "in"
    } satisfies Connection;
    const edge = {
      id: "edge",
      source: "value_1",
      sourceHandle: "value",
      target: "target_1",
      targetHandle: "in"
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
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.message");
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
      message: "Connections must run from an OUT port to an IN port."
    });
    expect(
      checkConnection(sampleGraph, {
        type: "addEdge",
        edge: {
          from: { node: "bang_1", port: "out" },
          to: { node: "target_1", port: "cold" }
        }
      }).message
    ).toMatch(/incompatible-edge-type: .*event\.bang.*value\.number\.float/);
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
      message: "value<number.float> connected to event<message.any>."
    });
    const secondBang = createGraphNodeFromDefinition(
      nodeRegistry.find((candidate) => candidate.id === "core.bang")!,
      sampleGraph.nodes
    );
    const messageToBangGraph = {
      ...sampleGraph,
      nodes: [...sampleGraph.nodes, { ...secondBang, id: "bang_2" }],
      edges: []
    };
    expect(
      isValidSkenionConnection(messageToBangGraph, {
        source: "event_log_1",
        sourceHandle: "out",
        target: "bang_2",
        targetHandle: "in"
      })
    ).toBe(true);
    expect(
      isValidSkenionConnection(
        {
          ...sampleGraph,
          edges: sampleGraph.edges.filter((edge) => edge.to.node !== "bang_1")
        },
        {
          source: "value_1",
          sourceHandle: "value",
          target: "bang_1",
          targetHandle: "in"
        }
      )
    ).toBe(true);
    expect(
      isValidSkenionConnection(messageToBangGraph, {
        source: "video_asset_1",
        sourceHandle: "asset",
        target: "event_log_1",
        targetHandle: "in"
      })
    ).toBe(false);
    expect(
      checkConnection(
        {
          ...sampleGraph,
          schemaVersion: "broken" as "0.1.0",
          edges: []
        },
        {
          type: "addEdge",
          edge: sampleGraph.edges[0]
        }
      ).ok
    ).toBe(false);
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
      message: "value<number.float> connected to value<number.float>."
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
            from: { node: "bang_1", port: "out" },
            to: { node: "shader_1", port: "speed" }
          }
        }
      ).message
    ).toMatch(/incompatible-edge-type: .*event\.bang.*value\.number\.float/);
    expect(
      checkConnection(renderSampleGraph, {
        type: "addEdge",
        edge: {
          from: { node: "output_1", port: "in" },
          to: { node: "shader_1", port: "speed" }
        }
      })
    ).toEqual({
      ok: false,
      message: "Connections must run from an OUT port to an IN port."
    });
    expect(
      isValidSkenionConnection(
        {
          ...sampleGraph,
          edges: sampleGraph.edges.filter(
            (edge) => !(edge.from.node === "gpu_upload_1" && edge.to.node === "preview_1")
          )
        },
        {
          source: "gpu_upload_1",
          sourceHandle: "texture",
          target: "preview_1",
          targetHandle: "texture"
        }
      )
    ).toBe(true);
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
