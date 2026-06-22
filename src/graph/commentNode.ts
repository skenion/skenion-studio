import type { DisplayGraphNodeV01 } from "./patchLibrary";
import type { GraphPatch } from "./skenionGraph";

export const COMMENT_NODE_KIND = "core.comment";
export const DEFAULT_COMMENT_TEXT = "";

export function isCommentNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === COMMENT_NODE_KIND;
}

export function defaultCommentParams(): Record<string, unknown> {
  return {
    text: DEFAULT_COMMENT_TEXT
  };
}

export function readCommentTextParam(node: DisplayGraphNodeV01): string {
  return typeof node.params.text === "string" ? node.params.text : DEFAULT_COMMENT_TEXT;
}

export function setCommentTextParamPatch(nodeId: string, text: string): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "text",
    value: text
  };
}
