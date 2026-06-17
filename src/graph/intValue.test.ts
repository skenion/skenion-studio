import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  DEFAULT_INT_VALUE,
  INT_VALUE_NODE_KIND,
  defaultIntValueParams,
  isIntValueNode,
  readIntValueParam,
  setIntValueParamPatch
} from "./intValue";

describe("integer value graph helpers", () => {
  it("identifies integer value nodes and default params", () => {
    const node = intNode(12);

    expect(isIntValueNode(node)).toBe(true);
    expect(isIntValueNode({ ...node, kind: "core.value-f32" })).toBe(false);
    expect(isIntValueNode(null)).toBe(false);
    expect(defaultIntValueParams()).toEqual({ value: DEFAULT_INT_VALUE });
  });

  it("reads integer values only", () => {
    expect(readIntValueParam(intNode(12))).toBe(12);
    expect(readIntValueParam(intNode(12.5))).toBe(DEFAULT_INT_VALUE);
    expect(readIntValueParam(intNode("12"))).toBe(DEFAULT_INT_VALUE);
  });

  it("creates integer setNodeParam patch operations", () => {
    expect(setIntValueParamPatch("value_1", 12.8)).toEqual({
      type: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: 12
    });
    expect(setIntValueParamPatch("value_1", Number.NaN)).toMatchObject({
      value: DEFAULT_INT_VALUE
    });
  });
});

function intNode(value: unknown): GraphNodeV01 {
  return {
    id: "value_1",
    kind: INT_VALUE_NODE_KIND,
    kindVersion: "0.1.0",
    params: {
      value
    },
    ports: []
  };
}
