import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  DEFAULT_UINT_REPRESENTATION,
  DEFAULT_UINT_VALUE,
  UINT_VALUE_NODE_KIND,
  defaultUIntValueParams,
  isUIntValueNode,
  readUIntRepresentationParam,
  readUIntValueParam,
  setUIntValueParamPatch
} from "./uintValue";

describe("unsigned integer value graph helpers", () => {
  it("identifies uint value nodes and default params", () => {
    const node = uintNode(12);

    expect(isUIntValueNode(node)).toBe(true);
    expect(isUIntValueNode({ ...node, kind: "core.int" })).toBe(false);
    expect(isUIntValueNode(null)).toBe(false);
    expect(defaultUIntValueParams()).toEqual({
      representation: DEFAULT_UINT_REPRESENTATION,
      value: DEFAULT_UINT_VALUE
    });
  });

  it("reads unsigned integer values and representations", () => {
    expect(readUIntValueParam(uintNode(12))).toBe(12);
    expect(readUIntValueParam(uintNode(-1))).toBe(DEFAULT_UINT_VALUE);
    expect(readUIntValueParam(uintNode(12.5))).toBe(DEFAULT_UINT_VALUE);
    expect(readUIntValueParam(uintNode(Number.NaN))).toBe(DEFAULT_UINT_VALUE);
    expect(readUIntValueParam(uintNode("12"))).toBe(DEFAULT_UINT_VALUE);
    expect(readUIntRepresentationParam(uintNode(12, "u8"))).toBe("u8");
    expect(readUIntRepresentationParam(uintNode(12, "bad"))).toBe(DEFAULT_UINT_REPRESENTATION);
  });

  it("creates uint setNodeParam patch operations", () => {
    expect(setUIntValueParamPatch("value_1", 12.8)).toEqual({
      type: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: 12
    });
    expect(setUIntValueParamPatch("value_1", -2)).toMatchObject({
      value: DEFAULT_UINT_VALUE
    });
    expect(setUIntValueParamPatch("value_1", Number.NaN)).toMatchObject({
      value: DEFAULT_UINT_VALUE
    });
  });
});

function uintNode(value: unknown, representation?: unknown): GraphNodeV01 {
  return {
    id: "value_1",
    kind: UINT_VALUE_NODE_KIND,
    kindVersion: "0.1.0",
    params: {
      representation,
      value
    },
    ports: []
  };
}
