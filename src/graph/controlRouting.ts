import type { DisplayGraphNodeV01 } from "./patchLibrary";

const ROUTING_CAPABLE_NODE_KINDS = new Set([
  "core.bang",
  "core.float",
  "core.int",
  "core.uint",
  "core.bool",
  "core.color",
  "core.string",
  "core.message",
  "core.comment",
  "core.panel"
]);

export function isRoutingCapableObjectNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return Boolean(node && ROUTING_CAPABLE_NODE_KINDS.has(node.kind));
}

export function readSendNameParam(node: DisplayGraphNodeV01): string {
  return typeof node.params.sendName === "string" ? node.params.sendName : "";
}

export function readReceiveNameParam(node: DisplayGraphNodeV01): string {
  return typeof node.params.receiveName === "string" ? node.params.receiveName : "";
}
