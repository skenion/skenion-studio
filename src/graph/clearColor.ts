import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { GraphPatch } from "./skenionGraph";
import { BOOL_VALUE_NODE_KIND, defaultBoolValueParams } from "./boolValue";
import { COMMENT_NODE_KIND, defaultCommentParams } from "./commentNode";
import { COLOR_NODE_KIND, defaultColorRgbaParams } from "./colorRgba";
import { FLOAT_VALUE_NODE_KIND, defaultFloatValueParams } from "./floatValue";
import { FULLSCREEN_SHADER_NODE_KIND, defaultFullscreenShaderParams } from "./fullscreenShader";
import { INT_VALUE_NODE_KIND, defaultIntValueParams } from "./intValue";
import { MESSAGE_NODE_KIND, defaultMessageParams } from "./messageNode";
import { PANEL_NODE_KIND, defaultPanelParams } from "./panelNode";
import { STRING_VALUE_NODE_KIND, defaultStringValueParams } from "./stringValue";
import { UINT_VALUE_NODE_KIND, defaultUIntValueParams } from "./uintValue";
import { VIDEO_ASSET_NODE_KIND, defaultVideoAssetParams } from "./videoAsset";
import { BANG_NODE_KIND, defaultBangParams } from "./panelControls";

export const CLEAR_COLOR_NODE_KIND = "render.clear-color";
export const DEFAULT_CLEAR_COLOR = [0.05, 0.08, 0.12, 1] as const;
export type ClearColor = [number, number, number, number];

export function isClearColorNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
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
  if (kind === INT_VALUE_NODE_KIND) {
    return defaultIntValueParams();
  }
  if (kind === UINT_VALUE_NODE_KIND) {
    return defaultUIntValueParams();
  }
  if (kind === BOOL_VALUE_NODE_KIND) {
    return defaultBoolValueParams();
  }
  if (kind === COLOR_NODE_KIND) {
    return defaultColorRgbaParams();
  }
  if (kind === STRING_VALUE_NODE_KIND) {
    return defaultStringValueParams();
  }
  if (kind === COMMENT_NODE_KIND) {
    return defaultCommentParams();
  }
  if (kind === PANEL_NODE_KIND) {
    return defaultPanelParams();
  }
  if (kind === MESSAGE_NODE_KIND) {
    return defaultMessageParams();
  }
  if (kind === VIDEO_ASSET_NODE_KIND) {
    return defaultVideoAssetParams();
  }
  if (kind === BANG_NODE_KIND) {
    return defaultBangParams();
  }

  return {};
}

export function readClearColorParam(node: DisplayGraphNodeV01): ClearColor {
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
