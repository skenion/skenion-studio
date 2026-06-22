import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphEditorPatch } from "./skenionGraph";

export const STRING_VALUE_NODE_KIND = "core.string";
export const DEFAULT_STRING_VALUE = "";

export function isStringValueNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === STRING_VALUE_NODE_KIND;
}

export function defaultStringValueParams(): Record<string, unknown> {
  return {
    value: DEFAULT_STRING_VALUE
  };
}

export function readStringValueParam(node: GraphNodeV01): string {
  return typeof node.params.value === "string" ? node.params.value : DEFAULT_STRING_VALUE;
}

export function setStringValueParamPatch(nodeId: string, value: string): GraphEditorPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value
  };
}
