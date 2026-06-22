import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { GraphPatch } from "./skenionGraph";

export const COLOR_NODE_KIND = "core.color";
export const DEFAULT_COLOR_VALUE = [1, 1, 1, 1] as const;
export const COLOR_REPRESENTATIONS = ["rgba32f", "rgba16f", "rgba8unorm", "rgb8unorm"] as const;
export type ColorRepresentation = (typeof COLOR_REPRESENTATIONS)[number];
export const DEFAULT_COLOR_REPRESENTATION: ColorRepresentation = "rgba32f";
export const COLOR_SPACES = ["linear", "srgb"] as const;
export type ColorSpace = (typeof COLOR_SPACES)[number];
export const DEFAULT_COLOR_SPACE: ColorSpace = "linear";
export type RgbaColor = [number, number, number, number];

export function isColorRgbaNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === COLOR_NODE_KIND;
}

export function defaultColorRgbaParams(): Record<string, unknown> {
  return {
    colorSpace: DEFAULT_COLOR_SPACE,
    representation: DEFAULT_COLOR_REPRESENTATION,
    value: [...DEFAULT_COLOR_VALUE]
  };
}

export function readColorRgbaParam(node: DisplayGraphNodeV01): RgbaColor {
  const color = node.params.value;
  if (!Array.isArray(color) || color.length !== 4) {
    return [...DEFAULT_COLOR_VALUE];
  }

  const values = color.map((component) =>
    typeof component === "number" && Number.isFinite(component)
      ? clamp01(component)
      : null
  );
  if (values.some((component) => component === null)) {
    return [...DEFAULT_COLOR_VALUE];
  }

  return values as RgbaColor;
}

export function readColorRepresentationParam(node: DisplayGraphNodeV01): ColorRepresentation {
  return COLOR_REPRESENTATIONS.includes(node.params.representation as ColorRepresentation)
    ? node.params.representation as ColorRepresentation
    : DEFAULT_COLOR_REPRESENTATION;
}

export function readColorSpaceParam(node: DisplayGraphNodeV01): ColorSpace {
  return COLOR_SPACES.includes(node.params.colorSpace as ColorSpace)
    ? node.params.colorSpace as ColorSpace
    : DEFAULT_COLOR_SPACE;
}

export function setColorRgbaParamPatch(nodeId: string, color: RgbaColor): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value: color.map(clamp01)
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
