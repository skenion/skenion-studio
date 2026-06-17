import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  BOOL_VALUE_NODE_KIND,
  DEFAULT_BOOL_VALUE,
  defaultBoolValueParams,
  isBoolValueNode,
  readBoolValueParam,
  setBoolValueParamPatch
} from "./boolValue";

describe("boolean value graph helpers", () => {
  it("identifies boolean value nodes and default params", () => {
    const node = boolNode(true);

    expect(isBoolValueNode(node)).toBe(true);
    expect(isBoolValueNode({ ...node, kind: "core.value-f32" })).toBe(false);
    expect(isBoolValueNode(null)).toBe(false);
    expect(defaultBoolValueParams()).toEqual({ value: DEFAULT_BOOL_VALUE });
  });

  it("reads boolean values only", () => {
    expect(readBoolValueParam(boolNode(true))).toBe(true);
    expect(readBoolValueParam(boolNode(false))).toBe(false);
    expect(readBoolValueParam(boolNode("true"))).toBe(DEFAULT_BOOL_VALUE);
  });

  it("creates boolean setNodeParam patch operations", () => {
    expect(setBoolValueParamPatch("value_1", true)).toEqual({
      type: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: true
    });
  });
});

function boolNode(value: unknown): GraphNodeV01 {
  return {
    id: "value_1",
    kind: BOOL_VALUE_NODE_KIND,
    kindVersion: "0.1.0",
    params: {
      value
    },
    ports: []
  };
}
