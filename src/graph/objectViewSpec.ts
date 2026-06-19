import type { GraphNodeV01 } from "@skenion/contracts";
import { BOOL_VALUE_NODE_KIND } from "./boolValue";
import { COLOR_NODE_KIND } from "./colorRgba";
import { COMMENT_NODE_KIND } from "./commentNode";
import { FLOAT_VALUE_NODE_KIND } from "./floatValue";
import { INT_VALUE_NODE_KIND } from "./intValue";
import { MESSAGE_NODE_KIND } from "./messageNode";
import { PANEL_NODE_KIND } from "./panelNode";
import {
  BANG_NODE_KIND,
  CHECKBOX_WIDGET,
  SLIDER_WIDGET,
  TOGGLE_WIDGET,
  TOGGLE_BOOL_NODE_KIND
} from "./panelControls";
import { STRING_VALUE_NODE_KIND } from "./stringValue";
import { UINT_VALUE_NODE_KIND } from "./uintValue";
import { VIDEO_ASSET_NODE_KIND } from "./videoAsset";

export type ObjectChromePolicy = "none" | "widget" | "box" | "container";

export type ObjectInteractionMode =
  | "asset-pick"
  | "layout-edit"
  | "message-trigger"
  | "numeric-drag"
  | "runtime-control"
  | "text-edit";

export interface ObjectViewSpec {
  chromePolicy: ObjectChromePolicy;
  interaction: ObjectInteractionMode;
}

export function objectViewSpecForNode(node: GraphNodeV01): ObjectViewSpec {
  if (node.kind === COMMENT_NODE_KIND) {
    return { chromePolicy: "none", interaction: "text-edit" };
  }
  if (node.kind === PANEL_NODE_KIND) {
    return { chromePolicy: "container", interaction: "runtime-control" };
  }
  if (
    node.kind === BANG_NODE_KIND ||
    (node.kind === TOGGLE_BOOL_NODE_KIND && (node.params.widget === TOGGLE_WIDGET || node.params.widget === CHECKBOX_WIDGET))
  ) {
    return { chromePolicy: "widget", interaction: "runtime-control" };
  }
  if (node.kind === FLOAT_VALUE_NODE_KIND && node.params.widget === SLIDER_WIDGET) {
    return { chromePolicy: "box", interaction: "runtime-control" };
  }
  if (node.kind === FLOAT_VALUE_NODE_KIND || node.kind === INT_VALUE_NODE_KIND || node.kind === UINT_VALUE_NODE_KIND) {
    return { chromePolicy: "box", interaction: "numeric-drag" };
  }
  if (node.kind === MESSAGE_NODE_KIND) {
    return { chromePolicy: "box", interaction: "message-trigger" };
  }
  if (
    node.kind === BOOL_VALUE_NODE_KIND ||
    node.kind === COLOR_NODE_KIND ||
    node.kind === STRING_VALUE_NODE_KIND
  ) {
    return { chromePolicy: "box", interaction: "runtime-control" };
  }
  if (node.kind === VIDEO_ASSET_NODE_KIND) {
    return { chromePolicy: "box", interaction: "asset-pick" };
  }
  return { chromePolicy: "box", interaction: "layout-edit" };
}
