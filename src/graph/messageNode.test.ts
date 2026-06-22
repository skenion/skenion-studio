import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  MESSAGE_NODE_KIND,
  defaultMessageParams,
  isMessageNode,
  readMessageValueParam
} from "./messageNode";

describe("message graph helpers", () => {
  it("identifies message nodes and reads value text", () => {
    const node = messageNode("perform");

    expect(isMessageNode(node)).toBe(true);
    expect(isMessageNode({ ...node, kind: "core.string" })).toBe(false);
    expect(isMessageNode(null)).toBe(false);
    expect(defaultMessageParams()).toEqual({ value: "" });
    expect(readMessageValueParam(node)).toBe("perform");
    expect(readMessageValueParam(messageNode(123))).toBe("");
  });
});

function messageNode(value: unknown): GraphNodeV01 {
  return {
    id: "message_1",
    kind: MESSAGE_NODE_KIND,
    kindVersion: "0.1.0",
    params: { value },
    ports: []
  };
}
