import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";

export const INT_VALUE_NODE_KIND = "core.value-i32";
export const DEFAULT_INT_VALUE = 0;

export function isIntValueNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === INT_VALUE_NODE_KIND;
}

export function defaultIntValueParams(): Record<string, unknown> {
  return {
    value: DEFAULT_INT_VALUE
  };
}

export function readIntValueParam(node: GraphNodeV01): number {
  return typeof node.params.value === "number" && Number.isInteger(node.params.value)
    ? node.params.value
    : DEFAULT_INT_VALUE;
}

export function setIntValueParamPatch(nodeId: string, value: number): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_INT_VALUE
  };
}
