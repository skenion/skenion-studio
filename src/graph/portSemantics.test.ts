import { describe, expect, it } from "vitest";
import type {
  DisplayEdgeV01 as EdgeV01,
  DisplayGraphDocumentV01 as GraphDocumentV01,
  DisplayGraphNodeV01 as GraphNodeV01
} from "./patchLibrary";
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
  it("derives current 0.1 artist-facing port metadata from persisted ports", () => {
    const shader = renderSampleGraph.nodes[0];
    const out = shader.ports.find((port) => port.id === "out")!;
    const uniform = shader.ports.find((port) => port.id === "speed")!;
    const colorUniform = shader.ports.find((port) => port.id === "tint")!;
    const semantics = portSemanticsForPort(shader, out);
    const uniformSemantics = portSemanticsForPort(shader, uniform);
    const colorSemantics = portSemanticsForPort(shader, colorUniform);

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
      storedType: "value<number.float>",
      type: "value.number.float"
    });
    expect(colorSemantics).toMatchObject({
      direction: "input",
      storedType: "value<color>",
      type: "value.color"
    });
    expect(semanticTypeColor("render.frame")).toBe("#d6336c");
    expect(semanticTypeColor("gpu.texture2d")).toBe("#7048e8");
    expect(semanticTypeColor("value.color")).toBe("#e64980");
    expect(semanticTypeColor("event.bang")).toBe("#f08c00");
    expect(semanticTypeColor("signal.audio")).toBe("#0ca678");
    expect(semanticTypeColor("stream.video.frame")).toBe("#1c7ed6");
    expect(semanticTypeColor("resource.asset.video")).toBe("#7950f2");
    expect(semanticTypeColor("value.number.float")).toBe("#495057");
  });

  it("preserves direct render frame and signal data kind labels", () => {
    const node: GraphNodeV01 = {
      id: "adapter",
      kind: "core.subpatch",
      kindVersion: "0.1.0",
      params: {},
      ports: [
        {
          id: "frame",
          direction: "output",
          type: { flow: "resource", dataKind: "render.frame" }
        },
        {
          id: "audio",
          direction: "output",
          type: { flow: "signal", dataKind: "signal.audio" }
        }
      ]
    };

    expect(portSemanticsForPort(node, node.ports[0]!).type).toBe("render.frame");
    expect(portSemanticsForPort(node, node.ports[1]!).type).toBe("signal.audio");
  });

  it("builds edge inspector metadata with current defaults and explicit overrides", () => {
    const edge = {
      ...renderSampleGraph.edges[0],
      id: "explicit_edge",
      order: 2,
      enabled: false,
      adapter: "adapter.example",
      feedback: { enabled: true, boundary: "render-frame", bufferMode: "latest" },
      styleOverride: "feedback"
    } as EdgeV01 & {
      id: string;
      order: number;
      enabled: boolean;
      adapter: string;
      feedback: { enabled: boolean; boundary: "render-frame"; bufferMode: "latest" };
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

  it("shows implicit numeric conversion metadata in the edge inspector", () => {
    const graph: GraphDocumentV01 = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "conversion-preview",
      revision: "1",
      nodes: [
        {
          id: "float_1",
          kind: "core.float",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "value", dataKind: "number.float", format: "f32" }
            }
          ]
        },
        {
          id: "uint_1",
          kind: "core.uint",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "value", dataKind: "number.uint", format: "u8" },
              activation: "trigger"
            }
          ]
        }
      ],
      edges: [{ from: { node: "float_1", port: "value" }, to: { node: "uint_1", port: "in" } }]
    };

    const conversion = edgeInspectorModel(graph, graph.edges[0]!).conversion;

    expect(conversion).toMatchObject({
      source: "number.float/f32",
      target: "number.uint/u8",
      lossy: true,
      policies: ["float-to-integer clamp=saturating trunc=toward-zero sanitize=nan-inf-to-finite"]
    });
    expect(conversion?.diagnostics[0]).toContain("implicit-lossy-conversion");
    expect(analyzeGraphPortSemantics(graph)).toEqual([]);
  });

  it("shows signedness and color representation conversion policies", () => {
    const graph: GraphDocumentV01 = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "conversion-policy-shapes",
      revision: "1",
      nodes: [
        {
          id: "int_1",
          kind: "core.int",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "value", dataKind: "number.int", format: "i32" }
            }
          ]
        },
        {
          id: "uint_1",
          kind: "core.uint",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "value", dataKind: "number.uint", format: "u8" },
              activation: "trigger"
            }
          ]
        },
        {
          id: "color_1",
          kind: "core.color",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "value", dataKind: "color", format: "rgba32f" }
            }
          ]
        },
        {
          id: "color_target_1",
          kind: "core.color-target",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "value", dataKind: "color", format: "rgba8unorm" },
              activation: "trigger"
            }
          ]
        }
      ],
      edges: [
        { from: { node: "int_1", port: "value" }, to: { node: "uint_1", port: "in" } },
        { from: { node: "color_1", port: "value" }, to: { node: "color_target_1", port: "in" } }
      ]
    };

    expect(edgeInspectorModel(graph, graph.edges[0]!).conversion?.policies).toEqual([
      "integer-signedness clamp=saturating"
    ]);
    expect(edgeInspectorModel(graph, graph.edges[1]!).conversion?.policies).toEqual([
      "color-cast clamp=unit quantize sanitize=nan-inf-to-finite"
    ]);
    expect(analyzeGraphPortSemantics(graph)).toEqual([]);
  });

  it("reports fan-in and type diagnostics without mutating graph documents", () => {
    const duplicateTarget: GraphDocumentV01 = {
      ...sampleGraph,
      edges: [
        sampleGraph.edges[0],
        {
          from: { node: "bang_1", port: "out" },
          to: { node: "target_1", port: "in" }
        }
      ]
    };

    const diagnostics = analyzeGraphPortSemantics(duplicateTarget);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "fan-in-forbidden"
    ]);
    expect(
      connectionSemanticCheck(sampleGraph, {
        type: "addEdge",
        edge: duplicateTarget.edges[1]
      })
    ).toMatchObject({ code: "fan-in-forbidden" });
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
      feedback: { enabled: true, boundary: "render-frame" }
    } as EdgeV01 & { feedback: { enabled: boolean; boundary: "render-frame" } };
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
      type: { flow: "value", dataKind: "number.float" },
      activation: "latched"
    },
    {
      id: "out",
      direction: "output",
      type: { flow: "value", dataKind: "number.float" }
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
