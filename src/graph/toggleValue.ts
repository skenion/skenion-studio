import type { DisplayGraphNodeV01 } from "./patchLibrary";
import { readBoolValueParam } from "./boolValue";
import { TOGGLE_BOOL_NODE_KIND, TOGGLE_WIDGET, CHECKBOX_WIDGET } from "./panelControls";

export const TOGGLE_NODE_KIND = TOGGLE_BOOL_NODE_KIND;

export function isToggleNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === TOGGLE_NODE_KIND && (node.params.widget === TOGGLE_WIDGET || node.params.widget === CHECKBOX_WIDGET);
}

export function defaultToggleParams(): Record<string, unknown> {
  return {
    widget: TOGGLE_WIDGET,
    value: false
  };
}

export function readToggleParam(node: DisplayGraphNodeV01): boolean {
  return readBoolValueParam(node);
}
