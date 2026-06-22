import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { GraphPatch } from "./skenionGraph";

export const INT_VALUE_NODE_KIND = "core.int";
export const DEFAULT_INT_VALUE = 0;
export const INT_REPRESENTATIONS = ["i64", "i32", "i16", "i8"] as const;
export type IntRepresentation = (typeof INT_REPRESENTATIONS)[number];
export const DEFAULT_INT_REPRESENTATION: IntRepresentation = "i32";

export function isIntValueNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === INT_VALUE_NODE_KIND;
}

export function defaultIntValueParams(): Record<string, unknown> {
  return {
    representation: DEFAULT_INT_REPRESENTATION,
    value: DEFAULT_INT_VALUE
  };
}

export function readIntValueParam(node: DisplayGraphNodeV01): number {
  return typeof node.params.value === "number" && Number.isInteger(node.params.value)
    ? node.params.value
    : DEFAULT_INT_VALUE;
}

export function readIntRepresentationParam(node: DisplayGraphNodeV01): IntRepresentation {
  return INT_REPRESENTATIONS.includes(node.params.representation as IntRepresentation)
    ? node.params.representation as IntRepresentation
    : DEFAULT_INT_REPRESENTATION;
}

export function setIntValueParamPatch(nodeId: string, value: number): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "value",
    value: Number.isFinite(value) ? Math.trunc(value) : DEFAULT_INT_VALUE
  };
}
