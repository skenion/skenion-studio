import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  TOGGLE_NODE_KIND,
  defaultToggleParams,
  isToggleNode,
  readToggleParam
} from "./toggleValue";

describe("toggle graph helpers", () => {
  it("identifies toggle nodes and reads params", () => {
    const node = toggleNode(true);

    expect(isToggleNode(node)).toBe(true);
    expect(isToggleNode({ ...node, kind: "core.bool" })).toBe(false);
    expect(isToggleNode(null)).toBe(false);
    expect(defaultToggleParams()).toEqual({ value: false });
    expect(readToggleParam(node)).toBe(true);
    expect(readToggleParam(toggleNode("yes"))).toBe(false);
  });
});

function toggleNode(value: unknown): GraphNodeV01 {
  return {
    id: "toggle_1",
    kind: TOGGLE_NODE_KIND,
    kindVersion: "0.1.0",
    params: { value },
    ports: []
  };
}
