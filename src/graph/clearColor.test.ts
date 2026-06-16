import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  CLEAR_COLOR_NODE_KIND,
  DEFAULT_CLEAR_COLOR,
  defaultParamsForNodeKind,
  isClearColorNode,
  readClearColorParam,
  replaceClearColorComponent,
  setClearColorParamPatch
} from "./clearColor";

describe("clear color graph helpers", () => {
  it("identifies clear color nodes and default params", () => {
    const node = clearNode([0.05, 0.08, 0.12, 1]);

    expect(isClearColorNode(node)).toBe(true);
    expect(isClearColorNode({ ...node, kind: "core.value-f32" })).toBe(false);
    expect(isClearColorNode(null)).toBe(false);
    expect(defaultParamsForNodeKind(CLEAR_COLOR_NODE_KIND)).toEqual({
      color: [...DEFAULT_CLEAR_COLOR]
    });
    expect(defaultParamsForNodeKind("core.value-f32")).toEqual({
      value: 0.5
    });
  });

  it("reads and clamps clear color params", () => {
    expect(readClearColorParam(clearNode([-1, 0.4, 2, 1.2]))).toEqual([0, 0.4, 1, 1]);
    expect(readClearColorParam(clearNode("red"))).toEqual([...DEFAULT_CLEAR_COLOR]);
    expect(readClearColorParam(clearNode([0.1, 0.2, 0.3]))).toEqual([...DEFAULT_CLEAR_COLOR]);
    expect(readClearColorParam(clearNode([0.1, Number.NaN, 0.3, 1]))).toEqual([...DEFAULT_CLEAR_COLOR]);
  });

  it("creates setNodeParam patches for clear color edits", () => {
    expect(replaceClearColorComponent([0.1, 0.2, 0.3, 1], 1, 2)).toEqual([0.1, 1, 0.3, 1]);
    expect(setClearColorParamPatch("clear_1", [1.2, -0.1, 0.2, 1])).toEqual({
      type: "setNodeParam",
      nodeId: "clear_1",
      key: "color",
      value: [1, 0, 0.2, 1]
    });
  });

  function clearNode(color: unknown): GraphNodeV01 {
    return {
      id: "clear_1",
      kind: CLEAR_COLOR_NODE_KIND,
      kindVersion: "0.1.0",
      params: {
        color
      },
      ports: []
    };
  }
});
