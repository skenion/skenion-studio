import type { GraphNodeV01 } from "@skenion/contracts";
import { readBoolValueParam } from "./boolValue";
import { TOGGLE_BOOL_NODE_KIND, TOGGLE_WIDGET, CHECKBOX_WIDGET } from "./panelControls";

export const TOGGLE_NODE_KIND = TOGGLE_BOOL_NODE_KIND;

export function isToggleNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === TOGGLE_NODE_KIND && (node.params.widget === TOGGLE_WIDGET || node.params.widget === CHECKBOX_WIDGET);
}

export function defaultToggleParams(): Record<string, unknown> {
  return {
    widget: TOGGLE_WIDGET,
    value: false
  };
}

export function readToggleParam(node: GraphNodeV01): boolean {
  return readBoolValueParam(node);
}
