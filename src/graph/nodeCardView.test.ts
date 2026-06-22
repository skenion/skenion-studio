import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import { renderSampleGraph } from "../data/sampleGraph";
import { toNodeCardView, toPortView } from "./nodeCardView";

describe("nodeCardView", () => {
  it("splits node ports into pure input and output view models", () => {
    const shaderCard = toNodeCardView(renderSampleGraph.nodes[0]!, true);
    const outputCard = toNodeCardView(renderSampleGraph.nodes[1]!);

    expect(shaderCard).toMatchObject({
      id: "shader_1",
      label: "Fullscreen Shader",
      kind: "render.fullscreen-shader",
      selected: true,
      typeBadgeLabel: "render.frame"
    });
    expect(shaderCard.inputs).toHaveLength(4);
    expect(shaderCard.inputs[0]).toMatchObject({
      id: "speed",
      direction: "input",
      typeLabel: "value.number.float",
      metadata: {
        maxConnections: 1,
        mergePolicy: "forbid",
        required: false
      }
    });
    expect(shaderCard.inputs[1]).toMatchObject({
      id: "enabled",
      direction: "input",
      typeLabel: "value.boolean"
    });
    expect(shaderCard.inputs[2]).toMatchObject({
      id: "iterations",
      direction: "input",
      typeLabel: "value.number.int"
    });
    expect(shaderCard.inputs[3]).toMatchObject({
      id: "tint",
      direction: "input",
      typeLabel: "value.color"
    });
    expect(shaderCard.outputs).toHaveLength(1);
    expect(shaderCard.outputs[0]).toMatchObject({
      id: "out",
      direction: "output",
      typeLabel: "render.frame",
      metadata: {
        fanOutPolicy: "allow",
        triggerMode: "passive"
      }
    });

    expect(outputCard.inputs).toHaveLength(1);
    expect(outputCard.outputs).toEqual([]);
    expect(outputCard.inputs[0]).toMatchObject({
      id: "in",
      direction: "input",
      typeLabel: "render.frame",
      metadata: {
        maxConnections: 1,
        mergePolicy: "forbid"
      }
    });
  });

  it("uses stable fallback labels and colors for zero-port nodes", () => {
    const node: GraphNodeV01 = {
      id: "empty_1",
      kind: "core.empty",
      kindVersion: "0.1.0",
      params: {},
      ports: []
    };

    expect(toNodeCardView(node)).toMatchObject({
      id: "empty_1",
      label: "empty_1",
      accentColor: "#868e96",
      inputs: [],
      outputs: []
    });
  });

  it("includes stored low-level type when artist-facing type differs", () => {
    const outputPort = renderSampleGraph.nodes[0]!.ports.find((port) => port.id === "out")!;
    const portView = toPortView(renderSampleGraph.nodes[0]!, outputPort);

    expect(portView.typeLabel).toBe("render.frame");
    expect(portView.storedTypeLabel).toBe("resource<gpu.texture2d>");
    expect(portView.color).toBe("#d6336c");
  });

  it("carries port descriptions into card tooltips", () => {
    const node: GraphNodeV01 = {
      id: "patch_1",
      kind: "core.subpatch",
      kindVersion: "0.1.0",
      params: {},
      ports: [
        {
          id: "pitch",
          direction: "input",
          label: "Pitch",
          type: { flow: "value", dataKind: "number.float", format: "f32" },
          description: "Pitch in MIDI note numbers."
        } as GraphNodeV01["ports"][number]
      ]
    };

    expect(toNodeCardView(node).inputs[0]).toMatchObject({
      id: "pitch",
      description: "Pitch in MIDI note numbers."
    });
  });
});
