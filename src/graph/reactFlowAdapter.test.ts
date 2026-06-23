import { describe, expect, it } from "vitest";
import type {
  DisplayEdgeV01 as EdgeV01,
  DisplayGraphDocumentV01 as GraphDocumentV01
} from "./patchLibrary";
import {
  portDemoSampleGraph,
  portDemoSampleViewState,
  renderSampleGraph,
  sampleGraph,
  shaderMultiUniformSampleGraph,
  shaderMultiUniformSampleViewState,
  shaderUniformSampleGraph,
  shaderUniformSampleViewState
} from "../data/sampleGraph";
import { createViewStateFromPositions } from "./projectDocument";
import { defaultPosition, flowColor, flowName, toReactFlowViewModel } from "./reactFlowAdapter";

describe("React Flow adapter", () => {
  it("derives React Flow nodes and edges from a skenion graph", () => {
    const viewModel = toReactFlowViewModel(
      sampleGraph,
      createViewStateFromPositions(sampleGraph, {
        value_1: { x: 10, y: 20 }
      })
    );

    expect(viewModel.nodes[0]).toMatchObject({
      id: "value_1",
      position: { x: 10, y: 20 },
      data: {
        label: "Float",
        kind: "core.float",
        kindVersion: "0.1.0",
        primaryFlow: "value"
      }
    });
    expect(viewModel.nodes[1].position).toEqual({ x: 376, y: 96 });
    expect(viewModel.edges[0]).toMatchObject({
      id: "value_1.value->target_1.in",
      source: "value_1",
      target: "target_1",
      type: "smoothstep",
      label: "value.number.float",
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
    const viewModel = toReactFlowViewModel(
      renderSampleGraph,
      createViewStateFromPositions(renderSampleGraph, {})
    );

    expect(viewModel.nodes.map((node) => node.id)).toEqual(["shader_1", "output_1"]);
    expect(viewModel.nodes[0].data.card.inputs).toHaveLength(4);
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
      shaderUniformSampleViewState
    );
    const shaderMultiUniformViewModel = toReactFlowViewModel(
      shaderMultiUniformSampleGraph,
      shaderMultiUniformSampleViewState
    );
    const portDemoViewModel = toReactFlowViewModel(portDemoSampleGraph, portDemoSampleViewState);

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
      ["value_1", "value", "shader_1", "speed"],
      ["shader_1", "out", "output_1", "in"]
    ]);
    expect(shaderMultiUniformViewModel.edges.map((edge) => [
      edge.source,
      edge.sourceHandle,
      edge.target,
      edge.targetHandle
    ])).toEqual([
      ["value_1", "value", "shader_1", "speed"],
      ["value_2", "value", "shader_1", "phase"],
      ["color_1", "value", "shader_1", "tint"],
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
      feedback: { enabled: true, boundary: "render-frame" }
    } as EdgeV01 & { feedback: { enabled: boolean; boundary: "render-frame" } };
    const viewModel = toReactFlowViewModel(
      {
        ...renderSampleGraph,
        edges: [feedbackEdge]
      },
      createViewStateFromPositions(renderSampleGraph, {})
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

    const viewModel = toReactFlowViewModel(graph, createViewStateFromPositions(graph, {}));

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

  it("falls back to adapter layout when view state omits a graph node", () => {
    const viewModel = toReactFlowViewModel(sampleGraph, {
      schema: "skenion.view-state",
      schemaVersion: "0.1.0",
      canvas: {
        nodes: {
          value_1: { x: 10, y: 20 }
        },
        viewport: { x: 0, y: 0, zoom: 1 }
      }
    });

    expect(viewModel.nodes[1].position).toEqual(defaultPosition(1));
  });

  it("keeps runtime control values out of the static graph view model", () => {
    const viewModel = toReactFlowViewModel(
      sampleGraph,
      createViewStateFromPositions(sampleGraph, {})
    );

    expect(viewModel.nodes[0].data.node.params.value).toBe(0.5);
    expect(viewModel.nodes[0].data.runtimeControlValue).toBeUndefined();
    expect(viewModel.nodes[1].data.runtimeControlValue).toBeUndefined();
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
