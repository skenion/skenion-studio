import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphEditorPatch } from "./skenionGraph";

export const COMMENT_NODE_KIND = "core.comment";
export const DEFAULT_COMMENT_TEXT = "";

export function isCommentNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === COMMENT_NODE_KIND;
}

export function defaultCommentParams(): Record<string, unknown> {
  return {
    text: DEFAULT_COMMENT_TEXT
  };
}

export function readCommentTextParam(node: GraphNodeV01): string {
  return typeof node.params.text === "string" ? node.params.text : DEFAULT_COMMENT_TEXT;
}

export function setCommentTextParamPatch(nodeId: string, text: string): GraphEditorPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "text",
    value: text
  };
}
