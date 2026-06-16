import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
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
    expect(shaderCard.inputs).toHaveLength(1);
    expect(shaderCard.inputs[0]).toMatchObject({
      id: "u_value",
      direction: "input",
      typeLabel: "value.f32",
      metadata: {
        maxConnections: 1,
        mergePolicy: "forbid",
        required: false
      }
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
      kindVersion: "0.2.0",
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
});
