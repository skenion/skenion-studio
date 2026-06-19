import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import { runtimeControlValueForNode } from "./controlValue";

describe("runtime control value helpers", () => {
  it("maps value node params into runtime control values", () => {
    expect(runtimeControlValueForNode(valueNode("core.float", 1.25))).toEqual({
      type: "float",
      representation: "f32",
      value: 1.25
    });
    expect(runtimeControlValueForNode(valueNode("core.int", 32))).toEqual({
      type: "int",
      representation: "i32",
      value: 32
    });
    expect(runtimeControlValueForNode(valueNode("core.uint", 42))).toEqual({
      type: "uint",
      representation: "u32",
      value: 42
    });
    expect(runtimeControlValueForNode(valueNode("core.bool", true))).toEqual({
      type: "bool",
      value: true
    });
    expect(runtimeControlValueForNode(valueNode("core.color", [0.1, 0.2, 0.3, 1]))).toEqual({
      type: "color",
      representation: "rgba32f",
      colorSpace: "linear",
      value: [0.1, 0.2, 0.3, 1]
    });
    expect(runtimeControlValueForNode(valueNode("core.string", "ready"))).toEqual({
      type: "string",
      value: "ready"
    });
    expect(runtimeControlValueForNode(valueNode("core.toggle", true))).toEqual({
      type: "bool",
      value: true
    });
    expect(runtimeControlValueForNode(valueNode("ui.slider-float", 0.75))).toEqual({
      type: "float",
      representation: "f32",
      value: 0.75
    });
    expect(runtimeControlValueForNode(valueNode("ui.button", undefined))).toBeNull();
    expect(runtimeControlValueForNode(valueNode("core.message", "perform"))).toEqual({
      type: "string",
      value: "perform"
    });
  });

  it("ignores non value-control nodes", () => {
    expect(runtimeControlValueForNode(valueNode("render.fullscreen-shader", 0))).toBeNull();
  });
});

function valueNode(kind: string, value: unknown): GraphNodeV01 {
  return {
    id: "value_1",
    kind,
    kindVersion: "0.1.0",
    params: {
      value
    },
    ports: []
  };
}
