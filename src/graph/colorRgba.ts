import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";

export const COLOR_RGBA_NODE_KIND = "core.color-rgba";
export const DEFAULT_COLOR_RGBA = [1, 1, 1, 1] as const;
export type RgbaColor = [number, number, number, number];

export function isColorRgbaNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === COLOR_RGBA_NODE_KIND;
}

export function defaultColorRgbaParams(): Record<string, unknown> {
  return {
    value: [...DEFAULT_COLOR_RGBA]
  };
}

export function readColorRgbaParam(node: GraphNodeV01): RgbaColor {
  const color = node.params.value;
  if (!Array.isArray(color) || color.length !== 4) {
    return [...DEFAULT_COLOR_RGBA];
  }

  const values = color.map((component) =>
    typeof component === "number" && Number.isFinite(component)
      ? clamp01(component)
      : null
  );
  if (values.some((component) => component === null)) {
    return [...DEFAULT_COLOR_RGBA];
  }

  return values as RgbaColor;
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
