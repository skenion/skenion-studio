import { describe, expect, it } from "vitest";
import type { NodeDefinitionManifestV01 } from "@skenion/contracts";
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
  portKey,
  toSkenionPatch,
  typeKey,
  typeLabel,
  validateGraph
} from "./skenionGraph";
import { UNRESOLVED_OBJECT_NODE_KIND } from "./objectTextNode";
import { displayGraphToContractGraph } from "./patchLibrary";

describe("skenion graph helpers", () => {
  it("formats type and port keys", () => {
    const type = { flow: "value", dataKind: "number.float", format: "float32" } as const;

    expect(typeLabel(type)).toBe("value<number.float>");
    expect(typeKey(type)).toBe('value:number.float:"float32"');
    expect(typeKey({ flow: "event", dataKind: "event.bang" })).toBe("event:event.bang:null");
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
    const groupedDefinition = {
      ...definition!,
      portGroups: [
        {
          id: "inputs",
          direction: "input",
          type: "number.float",
          minPorts: 1,
          label: "Inputs"
        }
      ]
    } satisfies NodeDefinitionManifestV01;
    const grouped = createGraphNodeFromDefinition(groupedDefinition, []);

    expect(first.id).toBe("float_1");
    expect(second.id).toBe("float_2");
    expect(skipped.id).toBe("float_3");
    expect(fallback.id).toBe("node_1");
    expect(second.ports[0]).not.toBe(definition!.ports[0]);
    expect(grouped.portGroups).toEqual(groupedDefinition.portGroups);
    expect(grouped.portGroups?.[0]).not.toBe(groupedDefinition.portGroups[0]);
  });

  it("summarizes and validates graphs", () => {
    const contractGraph = displayGraphToContractGraph(renderSampleGraph);
    const contractResult = validateGraph(contractGraph);

    expect(graphSummary(sampleGraph)).toBe("8 nodes · 5 edges · rev 1");
    expect(validateGraph(sampleGraph).ok).toBe(true);
    expect(graphSummary(renderSampleGraph)).toBe("2 nodes · 1 edges · rev 1");
    expect(validateGraph(renderSampleGraph).ok).toBe(true);
    expect(contractResult.ok).toBe(true);
    expect(contractResult.ok ? contractResult.value.nodes.map((node) => node.id) : []).toEqual(
      renderSampleGraph.nodes.map((node) => node.id)
    );
    expect(contractResult.ok ? contractResult.value.edges[0] : null).toEqual({
      id: "edge_shader_1_out_output_1_in",
      from: { node: "shader_1", port: "out" },
      to: { node: "output_1", port: "in" }
    });
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

  it("reports current 0.1 display graph validation errors", () => {
    const activeDisplayGraph = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "active-display-valid",
      revision: "1",
      nodes: [
        {
          id: "source_1",
          kind: "core.source",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "out",
              direction: "output",
              type: { flow: "value", dataKind: "number.float" },
              description: "Preserved current port help text."
            }
          ]
        }
      ],
      edges: []
    };
    const result = validateGraph({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "active-display",
      revision: "1",
      nodes: [
        {
          id: "collector_1",
          kind: "core.collector",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "value", dataKind: "number.float" },
              required: true,
              description: "Requires an upstream value."
            }
          ]
        }
      ],
      edges: []
    });

    expect(validateGraph(activeDisplayGraph)).toEqual({ ok: true, value: activeDisplayGraph });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual([
      "missing-required-input: input collector_1:in requires at least 1 connection(s)"
    ]);
  });

  it("converts React Flow connections and edges to skenion patches", () => {
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

  it("applies replacement patches and prunes invalid incident edges", () => {
    const outOnly = shaderUniformSampleGraph.nodes
      .find((node) => node.id === "shader_1")!
      .ports.filter((port) => port.id === "out");
    const shaderInterface = applyPatch(shaderUniformSampleGraph, {
      type: "replaceNodeInterface",
      nodeId: "shader_1",
      ports: outOnly,
      edgePolicy: "removeInvalidEdges"
    });

    expect(shaderInterface.nodes.find((node) => node.id === "shader_1")?.ports.map((port) => port.id)).toEqual([
      "out"
    ]);
    expect(shaderInterface.edges).toEqual([shaderUniformSampleGraph.edges[1]]);

    const targetNode = sampleGraph.nodes.find((node) => node.id === "target_1")!;
    const sameTargetInterface = applyPatch(sampleGraph, {
      type: "replaceNodeInterface",
      nodeId: "target_1",
      ports: targetNode.ports,
      edgePolicy: "removeInvalidEdges"
    });
    expect(sameTargetInterface.edges).toHaveLength(sampleGraph.edges.length);

    const decode = sampleGraph.nodes.find((node) => node.id === "decode_1")!;
    const replacedDecode = applyPatch(sampleGraph, {
      type: "replaceNode",
      nodeId: "decode_1",
      node: {
        ...decode,
        params: {
          objectText: "decode"
        }
      },
      edgePolicy: "removeInvalidEdges"
    });
    expect(replacedDecode.nodes.find((node) => node.id === "decode_1")).toMatchObject({
      kind: "core.video-decode",
      params: {
        objectText: "decode"
      }
    });
    expect(replacedDecode.edges).toHaveLength(sampleGraph.edges.length);

    const unresolvedDecode = applyPatch(sampleGraph, {
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
    });
    expect(unresolvedDecode.nodes.find((node) => node.id === "decode_1")?.kind).toBe(UNRESOLVED_OBJECT_NODE_KIND);
    expect(unresolvedDecode.edges.some((edge) => edge.from.node === "decode_1" || edge.to.node === "decode_1")).toBe(
      false
    );
    expect(unresolvedDecode.edges).toHaveLength(sampleGraph.edges.length - 2);
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
