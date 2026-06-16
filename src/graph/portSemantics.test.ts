import { describe, expect, it } from "vitest";
import type { EdgeV01, GraphDocumentV01, GraphNodeV01 } from "@skenion/contracts";
import { renderSampleGraph, sampleGraph } from "../data/sampleGraph";
import {
  analyzeGraphPortSemantics,
  connectionSemanticCheck,
  edgeId,
  edgeInspectorModel,
  findEdgeInspectorModel,
  portSemanticsForPort,
  semanticTypeColor
} from "./portSemantics";

describe("port and edge semantics", () => {
  it("derives v0.2 artist-facing port metadata from persisted v0.1 ports", () => {
    const shader = renderSampleGraph.nodes[0];
    const out = shader.ports.find((port) => port.id === "out")!;
    const uniform = shader.ports.find((port) => port.id === "u_value")!;
    const semantics = portSemanticsForPort(shader, out);
    const uniformSemantics = portSemanticsForPort(shader, uniform);

    expect(semantics).toMatchObject({
      direction: "output",
      fanOutPolicy: "allow",
      maxConnections: null,
      mergePolicy: "forbid",
      rate: "render",
      required: false,
      storedType: "resource<gpu.texture2d>",
      triggerMode: "passive",
      type: "render.frame"
    });
    expect(uniformSemantics).toMatchObject({
      direction: "input",
      maxConnections: 1,
      mergePolicy: "forbid",
      rate: "control",
      required: false,
      storedType: "value<f32>",
      type: "value.f32"
    });
    expect(semanticTypeColor("render.frame")).toBe("#d6336c");
    expect(semanticTypeColor("gpu.texture2d")).toBe("#7048e8");
    expect(semanticTypeColor("event.bang")).toBe("#f08c00");
    expect(semanticTypeColor("signal.audio")).toBe("#0ca678");
    expect(semanticTypeColor("stream.video.frame")).toBe("#1c7ed6");
    expect(semanticTypeColor("resource.asset.video")).toBe("#7950f2");
    expect(semanticTypeColor("value.f32")).toBe("#495057");
  });

  it("builds edge inspector metadata with v0.2 defaults and explicit overrides", () => {
    const edge = {
      ...renderSampleGraph.edges[0],
      id: "explicit_edge",
      order: 2,
      enabled: false,
      adapter: "adapter.example",
      feedback: { boundary: "render-frame", bufferMode: "previous-frame", maxLatencyFrames: 1 },
      styleOverride: "feedback"
    } as EdgeV01 & {
      id: string;
      order: number;
      enabled: boolean;
      adapter: string;
      feedback: { boundary: string; bufferMode: string; maxLatencyFrames: number };
      styleOverride: string;
    };
    const graph: GraphDocumentV01 = {
      ...renderSampleGraph,
      edges: [edge]
    };

    expect(edgeId(edge)).toBe("explicit_edge");
    expect(edgeInspectorModel(graph, edge)).toMatchObject({
      id: "explicit_edge",
      source: "shader_1.out",
      target: "output_1.in",
      resolvedType: "render.frame",
      order: 2,
      enabled: false,
      adapter: "adapter.example",
      feedback: { boundary: "render-frame" },
      styleOverride: "feedback"
    });
    expect(findEdgeInspectorModel(graph, null)).toBeNull();
    expect(findEdgeInspectorModel(graph, "explicit_edge")?.feedback?.boundary).toBe("render-frame");
    expect(findEdgeInspectorModel(graph, "missing")).toBeNull();
  });

  it("reports fan-in and type diagnostics without mutating graph documents", () => {
    const duplicateTarget: GraphDocumentV01 = {
      ...sampleGraph,
      edges: [
        sampleGraph.edges[0],
        {
          from: { node: "bang_1", port: "bang" },
          to: { node: "target_1", port: "value" }
        }
      ]
    };

    const diagnostics = analyzeGraphPortSemantics(duplicateTarget);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "incompatible-edge-type",
      "fan-in-forbidden"
    ]);
    expect(
      connectionSemanticCheck(sampleGraph, {
        type: "addEdge",
        edge: duplicateTarget.edges[1]
      })
    ).toMatchObject({ code: "incompatible-edge-type" });
    expect(connectionSemanticCheck(sampleGraph, null)).toBeNull();

    const mergeForbiddenTarget: GraphDocumentV01 = {
      ...sampleGraph,
      nodes: sampleGraph.nodes.map((node) =>
        node.id === "target_1"
          ? {
              ...node,
              ports: [
                {
                  ...node.ports[0],
                  maxConnections: 3,
                  mergePolicy: "forbid"
                } as GraphNodeV01["ports"][number] & { maxConnections: number; mergePolicy: string }
              ]
            }
          : node
      ),
      edges: [sampleGraph.edges[0], sampleGraph.edges[0]]
    };
    expect(analyzeGraphPortSemantics(mergeForbiddenTarget).map((diagnostic) => diagnostic.code)).toEqual([
      "fan-in-forbidden"
    ]);
  });

  it("classifies missing endpoints, direction errors, and explicit feedback cycles", () => {
    const graph = twoNodeValueCycle();
    const feedbackEdge = {
      ...graph.edges[1],
      feedback: { boundary: "render-frame" }
    } as EdgeV01 & { feedback: { boundary: string } };
    const feedbackGraph = {
      ...graph,
      edges: [graph.edges[0], feedbackEdge]
    };
    const invalidDirection: GraphDocumentV01 = {
      ...graph,
      edges: [
        {
          from: { node: "a", port: "in" },
          to: { node: "b", port: "in" }
        },
        {
          from: { node: "missing", port: "out" },
          to: { node: "b", port: "in" }
        }
      ]
    };

    expect(analyzeGraphPortSemantics(graph).map((diagnostic) => diagnostic.code)).toContain(
      "ambiguous-algebraic-loop"
    );
    expect(analyzeGraphPortSemantics(twoNodeStreamCycle()).map((diagnostic) => diagnostic.code)).toContain(
      "invalid-cycle"
    );
    expect(analyzeGraphPortSemantics(feedbackGraph).map((diagnostic) => diagnostic.code)).toContain(
      "feedback-cycle"
    );
    expect(analyzeGraphPortSemantics(invalidDirection).map((diagnostic) => diagnostic.code)).toEqual([
      "invalid-edge-direction",
      "missing-edge-endpoint"
    ]);
  });
});

function twoNodeValueCycle(): GraphDocumentV01 {
  const ports: GraphNodeV01["ports"] = [
    {
      id: "in",
      direction: "input",
      type: { flow: "value", dataKind: "f32" },
      activation: "latched"
    },
    {
      id: "out",
      direction: "output",
      type: { flow: "value", dataKind: "f32" }
    }
  ];

  return {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "cycle",
    revision: "1",
    nodes: [
      { id: "a", kind: "core.value-transform", kindVersion: "0.1.0", params: {}, ports },
      { id: "b", kind: "core.value-transform", kindVersion: "0.1.0", params: {}, ports }
    ],
    edges: [
      { from: { node: "a", port: "out" }, to: { node: "b", port: "in" } },
      { from: { node: "b", port: "out" }, to: { node: "a", port: "in" } }
    ]
  };
}

function twoNodeStreamCycle(): GraphDocumentV01 {
  const ports: GraphNodeV01["ports"] = [
    {
      id: "in",
      direction: "input",
      type: { flow: "stream", dataKind: "video.frame" },
      activation: "latched"
    },
    {
      id: "out",
      direction: "output",
      type: { flow: "stream", dataKind: "video.frame" }
    }
  ];

  return {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "stream-cycle",
    revision: "1",
    nodes: [
      { id: "a", kind: "core.stream-transform", kindVersion: "0.1.0", params: {}, ports },
      { id: "b", kind: "core.stream-transform", kindVersion: "0.1.0", params: {}, ports }
    ],
    edges: [
      { from: { node: "a", port: "out" }, to: { node: "b", port: "in" } },
      { from: { node: "b", port: "out" }, to: { node: "a", port: "in" } }
    ]
  };
}
