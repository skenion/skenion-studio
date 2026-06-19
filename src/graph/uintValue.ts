import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";

export const UINT_VALUE_NODE_KIND = "core.uint";
export const DEFAULT_UINT_VALUE = 0;
export const UINT_REPRESENTATIONS = ["u64", "u32", "u16", "u8"] as const;
export type UIntRepresentation = (typeof UINT_REPRESENTATIONS)[number];
export const DEFAULT_UINT_REPRESENTATION: UIntRepresentation = "u32";

export function isUIntValueNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === UINT_VALUE_NODE_KIND;
}

export function defaultUIntValueParams(): Record<string, unknown> {
  return {
    representation: DEFAULT_UINT_REPRESENTATION,
    value: DEFAULT_UINT_VALUE
  };
}

export function readUIntValueParam(node: GraphNodeV01): number {
  return typeof node.params.value === "number" && Number.isInteger(node.params.value) && node.params.value >= 0
    ? node.params.value
    : DEFAULT_UINT_VALUE;
}

export function readUIntRepresentationParam(node: GraphNodeV01): UIntRepresentation {
  return UINT_REPRESENTATIONS.includes(node.params.representation as UIntRepresentation)
    ? node.params.representation as UIntRepresentation
    : DEFAULT_UINT_REPRESENTATION;
}

export function setUIntValueParamPatch(nodeId: string, value: number): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : DEFAULT_UINT_VALUE
  };
}
