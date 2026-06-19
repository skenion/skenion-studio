import type { GraphNodeV01 } from "@skenion/contracts";
import type { RuntimeControlValue } from "../runtime/types";

export const UI_BUTTON_NODE_KIND = "ui.button";
export const UI_SLIDER_FLOAT_NODE_KIND = "ui.slider-float";
export const UI_TOGGLE_NODE_KIND = "ui.toggle";

export function isUiButtonNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === UI_BUTTON_NODE_KIND;
}

export function isUiSliderFloatNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === UI_SLIDER_FLOAT_NODE_KIND;
}

export function isUiToggleNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === UI_TOGGLE_NODE_KIND;
}

export function defaultUiButtonParams(): Record<string, unknown> {
  return {
    label: "Bang"
  };
}

export function defaultUiSliderFloatParams(): Record<string, unknown> {
  return {
    label: "Value",
    value: 0,
    min: 0,
    max: 1,
    step: 0.01
  };
}

export function defaultUiToggleParams(): Record<string, unknown> {
  return {
    label: "Enabled",
    value: false
  };
}

export function readPanelLabelParam(node: GraphNodeV01): string {
  return typeof node.params.label === "string" && node.params.label.length > 0
    ? node.params.label
    : node.id;
}

export function readUiSliderParams(node: GraphNodeV01) {
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

export function readUiToggleValue(node: GraphNodeV01): boolean {
  return typeof node.params.value === "boolean" ? node.params.value : false;
}

export function runtimeControlValueForUiNode(node: GraphNodeV01): RuntimeControlValue | null {
  if (isUiSliderFloatNode(node)) {
    return {
      type: "float",
      representation: "f32",
      value: readUiSliderParams(node).value
    };
  }
  if (isUiToggleNode(node)) {
    return {
      type: "bool",
      value: readUiToggleValue(node)
    };
  }
  return null;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
