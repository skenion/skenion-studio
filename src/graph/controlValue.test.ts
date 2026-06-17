import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import { runtimeControlValueForNode } from "./controlValue";

describe("runtime control value helpers", () => {
  it("maps value node params into runtime control values", () => {
    expect(runtimeControlValueForNode(valueNode("core.value-f32", 1.25))).toEqual({
      type: "f32",
      value: 1.25
    });
    expect(runtimeControlValueForNode(valueNode("core.value-i32", 32))).toEqual({
      type: "i32",
      value: 32
    });
    expect(runtimeControlValueForNode(valueNode("core.value-bool", true))).toEqual({
      type: "bool",
      value: true
    });
    expect(runtimeControlValueForNode(valueNode("core.color-rgba", [0.1, 0.2, 0.3, 1]))).toEqual({
      type: "rgba",
      value: [0.1, 0.2, 0.3, 1]
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
