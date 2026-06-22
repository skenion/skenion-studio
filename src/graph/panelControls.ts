import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { RuntimeControlValue } from "../runtime/types";

export const BANG_NODE_KIND = "core.bang";
export const SLIDER_FLOAT_NODE_KIND = "core.float";
export const TOGGLE_BOOL_NODE_KIND = "core.bool";
export const SLIDER_WIDGET = "slider";
export const TOGGLE_WIDGET = "toggle";
export const CHECKBOX_WIDGET = "checkbox";
export const DEFAULT_BANG_RADIUS = "999px";

export function isBangControlNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === BANG_NODE_KIND;
}

export function isSliderFloatNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === SLIDER_FLOAT_NODE_KIND && node.params.widget === SLIDER_WIDGET;
}

export function isToggleControlNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === TOGGLE_BOOL_NODE_KIND && isToggleWidget(node.params.widget);
}

export function defaultBangParams(): Record<string, unknown> {
  return {
    label: "Bang",
    radius: DEFAULT_BANG_RADIUS
  };
}

export function defaultSliderFloatParams(): Record<string, unknown> {
  return {
    label: "Value",
    widget: SLIDER_WIDGET,
    value: 0,
    min: 0,
    max: 1,
    step: 0.01
  };
}

export function defaultToggleControlParams(): Record<string, unknown> {
  return {
    label: "Enabled",
    widget: TOGGLE_WIDGET,
    value: false
  };
}

export function readPanelLabelParam(node: DisplayGraphNodeV01): string {
  return typeof node.params.label === "string" && node.params.label.length > 0
    ? node.params.label
    : node.id;
}

export function readBangParams(node: DisplayGraphNodeV01) {
  return {
    label: readPanelLabelParam(node),
    radius: cssRadiusParam(node.params.radius, DEFAULT_BANG_RADIUS)
  };
}

export function readSliderFloatParams(node: DisplayGraphNodeV01) {
  const value = finiteNumber(node.params.value, 0);
  const min = finiteNumber(node.params.min, 0);
  const max = finiteNumber(node.params.max, 1);
  const step = finiteNumber(node.params.step, 0.01);
  return {
    label: readPanelLabelParam(node),
    value,
    min,
    max: max > min ? max : min + 1,
    step: step > 0 ? step : 0.01
  };
}

export function readToggleControlValue(node: DisplayGraphNodeV01): boolean {
  return typeof node.params.value === "boolean" ? node.params.value : false;
}

export function runtimeControlValueForPanelNode(node: DisplayGraphNodeV01): RuntimeControlValue | null {
  if (isSliderFloatNode(node)) {
    return {
      type: "float",
      representation: "f32",
      value: readSliderFloatParams(node).value
    };
  }
  if (isToggleControlNode(node)) {
    return {
      type: "bool",
      value: readToggleControlValue(node)
    };
  }
  return null;
}

function isToggleWidget(widget: unknown): boolean {
  return widget === TOGGLE_WIDGET || widget === CHECKBOX_WIDGET;
}

function cssRadiusParam(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return `${value}px`;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  if (/^(0|[0-9]+(?:\.[0-9]+)?(px|rem|em|%)?)$/.test(trimmed)) {
    return trimmed === "0" ? "0px" : trimmed;
  }
  return fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
