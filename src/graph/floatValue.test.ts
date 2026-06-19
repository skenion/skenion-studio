import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import { graphPatchFromStudioAction } from "./graphPatch";
import {
  DEFAULT_FLOAT_REPRESENTATION,
  DEFAULT_FLOAT_VALUE,
  FLOAT_VALUE_NODE_KIND,
  defaultFloatValueParams,
  isFloatValueNode,
  readFloatRepresentationParam,
  readFloatValueParam,
  setFloatValueParamPatch
} from "./floatValue";

describe("float value graph helpers", () => {
  it("identifies float value nodes and default params", () => {
    const node = floatNode(0.25);

    expect(isFloatValueNode(node)).toBe(true);
    expect(isFloatValueNode({ ...node, kind: "core.int" })).toBe(false);
    expect(isFloatValueNode(null)).toBe(false);
    expect(defaultFloatValueParams()).toEqual({
      representation: DEFAULT_FLOAT_REPRESENTATION,
      value: DEFAULT_FLOAT_VALUE
    });
  });

  it("reads finite values without a global uniform range", () => {
    expect(readFloatValueParam(floatNode(0.25))).toBe(0.25);
    expect(readFloatValueParam(floatNode(-1))).toBe(-1);
    expect(readFloatValueParam(floatNode(2))).toBe(2);
    expect(readFloatValueParam(floatNode(Number.NaN))).toBe(DEFAULT_FLOAT_VALUE);
    expect(readFloatValueParam(floatNode("0.2"))).toBe(DEFAULT_FLOAT_VALUE);
    expect(readFloatRepresentationParam(floatNode(0.25, "f16"))).toBe("f16");
    expect(readFloatRepresentationParam(floatNode(0.25, "bad"))).toBe(DEFAULT_FLOAT_REPRESENTATION);
  });

  it("creates setNodeParam patch operations for value edits", () => {
    const patch = setFloatValueParamPatch("value_1", 1.25);

    expect(patch).toEqual({
      type: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: 1.25
    });
    expect(graphPatchFromStudioAction(patch)).toEqual({
      op: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: 1.25
    });
    expect(setFloatValueParamPatch("value_1", Number.NaN)).toMatchObject({
      value: DEFAULT_FLOAT_VALUE
    });
  });

  function floatNode(value: unknown, representation?: unknown): GraphNodeV01 {
    return {
      id: "value_1",
      kind: FLOAT_VALUE_NODE_KIND,
      kindVersion: "0.1.0",
      params: {
        representation,
        value
      },
      ports: []
    };
  }
});
