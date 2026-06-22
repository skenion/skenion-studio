import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphEditorPatch } from "./skenionGraph";

export const BOOL_VALUE_NODE_KIND = "core.bool";
export const DEFAULT_BOOL_VALUE = false;

export function isBoolValueNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === BOOL_VALUE_NODE_KIND;
}

export function defaultBoolValueParams(): Record<string, unknown> {
  return {
    value: DEFAULT_BOOL_VALUE
  };
}

export function readBoolValueParam(node: GraphNodeV01): boolean {
  return typeof node.params.value === "boolean" ? node.params.value : DEFAULT_BOOL_VALUE;
}

export function setBoolValueParamPatch(nodeId: string, value: boolean): GraphEditorPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value
  };
}
