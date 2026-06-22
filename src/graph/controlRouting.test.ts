import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  isRoutingCapableObjectNode,
  readReceiveNameParam,
  readSendNameParam
} from "./controlRouting";

describe("control routing graph helpers", () => {
  it("identifies object-owned routing capable nodes", () => {
    expect(isRoutingCapableObjectNode(node("core.float", {}))).toBe(true);
    expect(isRoutingCapableObjectNode(node("core.bang", {}))).toBe(true);
    expect(isRoutingCapableObjectNode(node("core.uint", {}))).toBe(true);
    expect(isRoutingCapableObjectNode(node("core.message", {}))).toBe(true);
    expect(isRoutingCapableObjectNode(node("core.panel", {}))).toBe(true);
    expect(isRoutingCapableObjectNode(node("render.fullscreen-shader", {}))).toBe(false);
    expect(isRoutingCapableObjectNode(null)).toBe(false);
  });

  it("reads sendName and receiveName params without defaults", () => {
    expect(readSendNameParam(node("core.float", { sendName: "speed" }))).toBe("speed");
    expect(readReceiveNameParam(node("core.float", { receiveName: "speed" }))).toBe("speed");
    expect(readSendNameParam(node("core.float", { sendName: 1 }))).toBe("");
    expect(readReceiveNameParam(node("core.float", {}))).toBe("");
  });
});

function node(kind: string, params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "node_1",
    kind,
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}
