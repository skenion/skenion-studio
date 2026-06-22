import type { DisplayGraphNodeV01 } from "./patchLibrary";
import { readStringValueParam } from "./stringValue";

export const MESSAGE_NODE_KIND = "core.message";

export function isMessageNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === MESSAGE_NODE_KIND;
}

export function defaultMessageParams(): Record<string, unknown> {
  return {
    value: ""
  };
}

export function readMessageValueParam(node: DisplayGraphNodeV01): string {
  return readStringValueParam(node);
}
