import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  COLOR_NODE_KIND,
  DEFAULT_COLOR_REPRESENTATION,
  DEFAULT_COLOR_SPACE,
  DEFAULT_COLOR_VALUE,
  defaultColorRgbaParams,
  isColorRgbaNode,
  readColorRepresentationParam,
  readColorRgbaParam,
  readColorSpaceParam,
  setColorRgbaParamPatch
} from "./colorRgba";

describe("color rgba graph helpers", () => {
  it("identifies color nodes and default params", () => {
    expect(isColorRgbaNode(colorNode([0.2, 0.4, 0.6, 1]))).toBe(true);
    expect(isColorRgbaNode({ ...colorNode([0.2, 0.4, 0.6, 1]), kind: "core.float" })).toBe(false);
    expect(isColorRgbaNode(null)).toBe(false);
    expect(defaultColorRgbaParams()).toEqual({
      colorSpace: DEFAULT_COLOR_SPACE,
      representation: DEFAULT_COLOR_REPRESENTATION,
      value: [...DEFAULT_COLOR_VALUE]
    });
  });

  it("reads and clamps valid color values", () => {
    expect(readColorRgbaParam(colorNode([1.4, -0.1, 0.5, 1]))).toEqual([1, 0, 0.5, 1]);
    expect(readColorRepresentationParam(colorNode([1, 0, 0, 1], "rgba8unorm"))).toBe("rgba8unorm");
    expect(readColorRepresentationParam(colorNode([1, 0, 0, 1], "bad"))).toBe(DEFAULT_COLOR_REPRESENTATION);
    expect(readColorSpaceParam(colorNode([1, 0, 0, 1], "rgba32f", "srgb"))).toBe("srgb");
    expect(readColorSpaceParam(colorNode([1, 0, 0, 1], "rgba32f", "bad"))).toBe(DEFAULT_COLOR_SPACE);
  });

  it("falls back for invalid color values", () => {
    expect(readColorRgbaParam(colorNode([1, 0.5, 0.25]))).toEqual([...DEFAULT_COLOR_VALUE]);
    expect(readColorRgbaParam(colorNode([1, "no", 0.25, 1]))).toEqual([...DEFAULT_COLOR_VALUE]);
    expect(readColorRgbaParam({ ...colorNode([1, 0, 0, 1]), params: { value: false } })).toEqual([
      ...DEFAULT_COLOR_VALUE
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

function colorNode(value: unknown, representation?: unknown, colorSpace?: unknown): GraphNodeV01 {
  return {
    id: "color_1",
    kind: COLOR_NODE_KIND,
    kindVersion: "0.1.0",
    params: {
      colorSpace,
      representation,
      value
    },
    ports: []
  };
}
