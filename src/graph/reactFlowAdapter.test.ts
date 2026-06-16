import { describe, expect, it } from "vitest";
import type { EdgeV01, GraphDocumentV01 } from "@skenion/contracts";
import {
  portDemoSampleGraph,
  portDemoSamplePositions,
  renderSampleGraph,
  sampleGraph,
  shaderUniformSampleGraph,
  shaderUniformSamplePositions
} from "../data/sampleGraph";
import { defaultPosition, flowColor, flowName, toReactFlowViewModel } from "./reactFlowAdapter";

describe("React Flow adapter", () => {
  it("derives React Flow nodes and edges from a Skenion graph", () => {
    const viewModel = toReactFlowViewModel(sampleGraph, {
      value_1: { x: 10, y: 20 }
    });

    expect(viewModel.nodes[0]).toMatchObject({
      id: "value_1",
      position: { x: 10, y: 20 },
      data: {
        label: "Float",
        kind: "core.value-f32",
        kindVersion: "0.1.0",
        primaryFlow: "value"
      }
    });
    expect(viewModel.nodes[1].position).toEqual(defaultPosition(1));
    expect(viewModel.edges[0]).toMatchObject({
      id: "value_1.value->target_1.value",
      source: "value_1",
      target: "target_1",
      type: "smoothstep",
      label: "value.f32",
      interactionWidth: 18,
      animated: false,
      style: {
        stroke: "#495057",
        strokeWidth: 2
      }
    });
    expect(viewModel.edges[1].animated).toBe(true);
    expect(viewModel.edges[3].animated).toBe(true);
    expect(viewModel.edges[4].style).toMatchObject({
      stroke: "#7048e8",
      strokeWidth: 3
    });
  });

  it("derives explicit render output sample edges", () => {
    const viewModel = toReactFlowViewModel(renderSampleGraph, {});

    expect(viewModel.nodes.map((node) => node.id)).toEqual(["shader_1", "output_1"]);
    expect(viewModel.nodes[0].data.card.inputs).toHaveLength(1);
    expect(viewModel.nodes[0].data.card.outputs).toHaveLength(1);
    expect(viewModel.nodes[1].data.card.inputs).toHaveLength(1);
    expect(viewModel.edges[0]).toMatchObject({
      id: "shader_1.out->output_1.in",
      source: "shader_1",
      sourceHandle: "out",
      target: "output_1",
      targetHandle: "in",
      type: "smoothstep",
      label: "render.frame",
      interactionWidth: 18,
      style: {
        stroke: "#d6336c",
        strokeWidth: 3
      }
    });
  });

  it("preserves explicit sample graph handle mappings and positions", () => {
    const shaderUniformViewModel = toReactFlowViewModel(
      shaderUniformSampleGraph,
      shaderUniformSamplePositions
    );
    const portDemoViewModel = toReactFlowViewModel(portDemoSampleGraph, portDemoSamplePositions);

    expect(shaderUniformViewModel.nodes.map((node) => [node.id, node.position])).toEqual([
      ["value_1", { x: 64, y: 120 }],
      ["shader_1", { x: 364, y: 120 }],
      ["output_1", { x: 664, y: 120 }]
    ]);
    expect(shaderUniformViewModel.edges.map((edge) => [
      edge.source,
      edge.sourceHandle,
      edge.target,
      edge.targetHandle
    ])).toEqual([
      ["value_1", "value", "shader_1", "u_value"],
      ["shader_1", "out", "output_1", "in"]
    ]);
    expect(portDemoViewModel.edges.map((edge) => edge.type)).toEqual([
      "smoothstep",
      "smoothstep",
      "smoothstep"
    ]);
  });

  it("marks explicit feedback edges in the view model", () => {
    const feedbackEdge = {
      ...renderSampleGraph.edges[0],
      feedback: { boundary: "render-frame" }
    } as EdgeV01 & { feedback: { boundary: string } };
    const viewModel = toReactFlowViewModel(
      {
        ...renderSampleGraph,
        edges: [feedbackEdge]
      },
      {}
    );

    expect(viewModel.edges[0]).toMatchObject({
      animated: true,
      markerStart: {
        color: "#d6336c"
      },
      style: {
        strokeDasharray: "7 4"
      }
    });
  });

  it("uses fallback node and edge data when ports or params are absent", () => {
    const graph: GraphDocumentV01 = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "fallback",
      revision: "1",
      nodes: [
        {
          id: "empty",
          kind: "core.empty",
          kindVersion: "0.1.0",
          params: {},
          ports: []
        }
      ],
      edges: [
        {
          from: { node: "missing", port: "out" },
          to: { node: "empty", port: "in" }
        }
      ]
    };

    const viewModel = toReactFlowViewModel(graph, {});

    expect(viewModel.nodes[0].data.label).toBe("empty");
    expect(viewModel.nodes[0].data.primaryFlow).toBe("value");
    expect(viewModel.edges[0]).toMatchObject({
      label: "",
      animated: false,
      data: {
        typeKey: ""
      },
      style: {
        stroke: "#868e96",
        strokeWidth: 2
      }
    });
  });

  it("maps flow display color and names", () => {
    expect(defaultPosition(3)).toEqual({ x: 364, y: 252 });
    expect(flowColor("event")).toBe("#f08c00");
    expect(flowColor("signal")).toBe("#0ca678");
    expect(flowColor("stream")).toBe("#1c7ed6");
    expect(flowColor("resource")).toBe("#7950f2");
    expect(flowColor("value")).toBe("#495057");
    expect(flowColor("resource", "gpu.texture2d")).toBe("#7048e8");
    expect(flowName("resource")).toBe("resource");
    expect(flowName("resource", "gpu.texture2d")).toBe("gpu resource");
  });
});
