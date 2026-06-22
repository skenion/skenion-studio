import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { GraphPatch } from "./skenionGraph";

export const BOOL_VALUE_NODE_KIND = "core.bool";
export const DEFAULT_BOOL_VALUE = false;

export function isBoolValueNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === BOOL_VALUE_NODE_KIND;
}

export function defaultBoolValueParams(): Record<string, unknown> {
  return {
    value: DEFAULT_BOOL_VALUE
  };
}

export function readBoolValueParam(node: DisplayGraphNodeV01): boolean {
  return typeof node.params.value === "boolean" ? node.params.value : DEFAULT_BOOL_VALUE;
}

export function setBoolValueParamPatch(nodeId: string, value: boolean): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value
  };
}
