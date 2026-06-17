import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";

export const FLOAT_VALUE_NODE_KIND = "core.value-f32";
export const DEFAULT_FLOAT_VALUE = 0.5;

export function isFloatValueNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === FLOAT_VALUE_NODE_KIND;
}

export function defaultFloatValueParams(): Record<string, unknown> {
  return {
    value: DEFAULT_FLOAT_VALUE
  };
}

export function readFloatValueParam(node: GraphNodeV01): number {
  return typeof node.params.value === "number" && Number.isFinite(node.params.value)
    ? node.params.value
    : DEFAULT_FLOAT_VALUE;
}

export function setFloatValueParamPatch(nodeId: string, value: number): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value: Number.isFinite(value) ? value : DEFAULT_FLOAT_VALUE
  };
}
