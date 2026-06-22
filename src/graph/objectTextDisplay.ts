import type { DisplayGraphNodeV01 } from "./patchLibrary";
import { nativeAliasForObjectKind } from "./objectTextNode";

export function genericObjectTextForNode(node: DisplayGraphNodeV01): string {
  return stringParam(node.params.objectText) ?? nativeAliasForObjectKind(node.kind) ?? stringParam(node.params.label) ?? node.kind;
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
