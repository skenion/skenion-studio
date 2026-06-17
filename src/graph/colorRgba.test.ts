import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  COLOR_RGBA_NODE_KIND,
  DEFAULT_COLOR_RGBA,
  defaultColorRgbaParams,
  isColorRgbaNode,
  readColorRgbaParam,
  setColorRgbaParamPatch
} from "./colorRgba";

describe("color rgba graph helpers", () => {
  it("identifies color nodes and default params", () => {
    expect(isColorRgbaNode(colorNode([0.2, 0.4, 0.6, 1]))).toBe(true);
    expect(isColorRgbaNode({ ...colorNode([0.2, 0.4, 0.6, 1]), kind: "core.value-f32" })).toBe(false);
    expect(isColorRgbaNode(null)).toBe(false);
    expect(defaultColorRgbaParams()).toEqual({ value: [...DEFAULT_COLOR_RGBA] });
  });

  it("reads and clamps valid color values", () => {
    expect(readColorRgbaParam(colorNode([1.4, -0.1, 0.5, 1]))).toEqual([1, 0, 0.5, 1]);
  });

  it("falls back for invalid color values", () => {
    expect(readColorRgbaParam(colorNode([1, 0.5, 0.25]))).toEqual([...DEFAULT_COLOR_RGBA]);
    expect(readColorRgbaParam(colorNode([1, "no", 0.25, 1]))).toEqual([...DEFAULT_COLOR_RGBA]);
    expect(readColorRgbaParam({ ...colorNode([1, 0, 0, 1]), params: { value: false } })).toEqual([
      ...DEFAULT_COLOR_RGBA
    ]);
  });

  it("creates clamped setNodeParam patch operations", () => {
    expect(setColorRgbaParamPatch("color_1", [1.2, -1, 0.5, 1])).toEqual({
      type: "setNodeParam",
      nodeId: "color_1",
      key: "value",
      value: [1, 0, 0.5, 1]
    });
  });
});

function colorNode(value: unknown): GraphNodeV01 {
  return {
    id: "color_1",
    kind: COLOR_RGBA_NODE_KIND,
    kindVersion: "0.1.0",
    params: {
      value
    },
    ports: []
  };
}
