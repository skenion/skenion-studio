import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  STRING_VALUE_NODE_KIND,
  defaultStringValueParams,
  isStringValueNode,
  readStringValueParam,
  setStringValueParamPatch
} from "./stringValue";

describe("string value graph helpers", () => {
  it("identifies string nodes and reads params", () => {
    const node = stringNode("ready");

    expect(isStringValueNode(node)).toBe(true);
    expect(isStringValueNode({ ...node, kind: "core.float" })).toBe(false);
    expect(isStringValueNode(null)).toBe(false);
    expect(defaultStringValueParams()).toEqual({ value: "" });
    expect(readStringValueParam(node)).toBe("ready");
    expect(readStringValueParam(stringNode(42))).toBe("");
  });

  it("creates setNodeParam patches", () => {
    expect(setStringValueParamPatch("string_1", "armed")).toEqual({
      type: "setNodeParam",
      nodeId: "string_1",
      key: "value",
      value: "armed"
    });
  });
});

function stringNode(value: unknown): GraphNodeV01 {
  return {
    id: "string_1",
    kind: STRING_VALUE_NODE_KIND,
    kindVersion: "0.1.0",
    params: { value },
    ports: []
  };
}
