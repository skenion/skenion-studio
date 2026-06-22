import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { GraphPatch } from "./skenionGraph";

export const STRING_VALUE_NODE_KIND = "core.string";
export const DEFAULT_STRING_VALUE = "";

export function isStringValueNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === STRING_VALUE_NODE_KIND;
}

export function defaultStringValueParams(): Record<string, unknown> {
  return {
    value: DEFAULT_STRING_VALUE
  };
}

export function readStringValueParam(node: DisplayGraphNodeV01): string {
  return typeof node.params.value === "string" ? node.params.value : DEFAULT_STRING_VALUE;
}

export function setStringValueParamPatch(nodeId: string, value: string): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value
  };
}
