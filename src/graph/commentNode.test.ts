import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  COMMENT_NODE_KIND,
  defaultCommentParams,
  isCommentNode,
  readCommentTextParam,
  setCommentTextParamPatch
} from "./commentNode";

describe("comment graph helpers", () => {
  it("identifies comment nodes and reads text", () => {
    const node = commentNode("explain the patch");

    expect(isCommentNode(node)).toBe(true);
    expect(isCommentNode({ ...node, kind: "core.message" })).toBe(false);
    expect(isCommentNode(null)).toBe(false);
    expect(defaultCommentParams()).toEqual({ text: "" });
    expect(readCommentTextParam(node)).toBe("explain the patch");
    expect(readCommentTextParam(commentNode(false))).toBe("");
  });

  it("creates text patches", () => {
    expect(setCommentTextParamPatch("comment_1", "note")).toEqual({
      type: "setNodeParam",
      nodeId: "comment_1",
      key: "text",
      value: "note"
    });
  });
});

function commentNode(text: unknown): GraphNodeV01 {
  return {
    id: "comment_1",
    kind: COMMENT_NODE_KIND,
    kindVersion: "0.1.0",
    params: { text },
    ports: []
  };
}
