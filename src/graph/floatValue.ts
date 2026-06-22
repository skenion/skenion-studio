import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphEditorPatch } from "./skenionGraph";

export const FLOAT_VALUE_NODE_KIND = "core.float";
export const DEFAULT_FLOAT_VALUE = 0.5;
export const FLOAT_REPRESENTATIONS = ["f64", "f32", "f16", "f8.e4m3", "f8.e5m2", "ufloat16", "ufloat8"] as const;
export type FloatRepresentation = (typeof FLOAT_REPRESENTATIONS)[number];
export const DEFAULT_FLOAT_REPRESENTATION: FloatRepresentation = "f32";

export function isFloatValueNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === FLOAT_VALUE_NODE_KIND;
}

export function defaultFloatValueParams(): Record<string, unknown> {
  return {
    representation: DEFAULT_FLOAT_REPRESENTATION,
    value: DEFAULT_FLOAT_VALUE
  };
}

export function readFloatValueParam(node: GraphNodeV01): number {
  return typeof node.params.value === "number" && Number.isFinite(node.params.value)
    ? node.params.value
    : DEFAULT_FLOAT_VALUE;
}

export function readFloatRepresentationParam(node: GraphNodeV01): FloatRepresentation {
  return FLOAT_REPRESENTATIONS.includes(node.params.representation as FloatRepresentation)
    ? node.params.representation as FloatRepresentation
    : DEFAULT_FLOAT_REPRESENTATION;
}

export function setFloatValueParamPatch(nodeId: string, value: number): GraphEditorPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value: Number.isFinite(value) ? value : DEFAULT_FLOAT_VALUE
  };
}
