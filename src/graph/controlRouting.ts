import type { GraphNodeV01 } from "@skenion/contracts";

const ROUTING_CAPABLE_NODE_KINDS = new Set([
  "core.float",
  "core.int",
  "core.bool",
  "core.color",
  "core.string",
  "core.message",
  "core.toggle",
  "core.comment",
  "core.panel",
  "ui.button",
  "ui.slider-float",
  "ui.toggle"
]);

export function isRoutingCapableObjectNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return Boolean(node && ROUTING_CAPABLE_NODE_KINDS.has(node.kind));
}

export function readSendNameParam(node: GraphNodeV01): string {
  return typeof node.params.sendName === "string" ? node.params.sendName : "";
}

export function readReceiveNameParam(node: GraphNodeV01): string {
  return typeof node.params.receiveName === "string" ? node.params.receiveName : "";
}
