import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";
import { FLOAT_VALUE_NODE_KIND, defaultFloatValueParams } from "./floatValue";
import { FULLSCREEN_SHADER_NODE_KIND, defaultFullscreenShaderParams } from "./fullscreenShader";

export const CLEAR_COLOR_NODE_KIND = "render.clear-color";
export const DEFAULT_CLEAR_COLOR = [0.05, 0.08, 0.12, 1] as const;
export type ClearColor = [number, number, number, number];

export function isClearColorNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === CLEAR_COLOR_NODE_KIND;
}

export function defaultParamsForNodeKind(kind: string): Record<string, unknown> {
  if (kind === CLEAR_COLOR_NODE_KIND) {
    return {
      color: [...DEFAULT_CLEAR_COLOR]
    };
  }
  if (kind === FULLSCREEN_SHADER_NODE_KIND) {
    return defaultFullscreenShaderParams();
  }
  if (kind === FLOAT_VALUE_NODE_KIND) {
    return defaultFloatValueParams();
  }

  return {};
}

export function readClearColorParam(node: GraphNodeV01): ClearColor {
  const color = node.params.color;
  if (!Array.isArray(color) || color.length !== 4) {
    return [...DEFAULT_CLEAR_COLOR];
  }

  const values = color.map((component) =>
    typeof component === "number" && Number.isFinite(component)
      ? clamp01(component)
      : null
  );
  if (values.some((component) => component === null)) {
    return [...DEFAULT_CLEAR_COLOR];
  }

  return values as ClearColor;
}

export function setClearColorParamPatch(nodeId: string, color: ClearColor): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "color",
    value: color.map(clamp01)
  };
}

export function replaceClearColorComponent(
  color: ClearColor,
  index: number,
  value: number
): ClearColor {
  const next: ClearColor = [...color];
  next[index] = clamp01(value);
  return next;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
