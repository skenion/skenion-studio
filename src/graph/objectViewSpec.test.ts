import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import { objectViewSpecForNode } from "./objectViewSpec";

describe("objectViewSpecForNode", () => {
  it("classifies editor chrome separately from object body behavior", () => {
    expect(objectViewSpecForNode(node("core.comment", {}))).toEqual({
      chromePolicy: "none",
      interaction: "text-edit"
    });
    expect(objectViewSpecForNode(node("core.panel", {}))).toEqual({
      chromePolicy: "container",
      interaction: "runtime-control"
    });
    expect(objectViewSpecForNode(node("core.bang", {}))).toEqual({
      chromePolicy: "widget",
      interaction: "runtime-control"
    });
    expect(objectViewSpecForNode(node("core.bool", { widget: "toggle" }))).toEqual({
      chromePolicy: "widget",
      interaction: "runtime-control"
    });
    expect(objectViewSpecForNode(node("core.float", { widget: "slider" }))).toEqual({
      chromePolicy: "box",
      interaction: "runtime-control"
    });
  });

  it("keeps value, message, asset, and fallback objects boxed", () => {
    expect(objectViewSpecForNode(node("core.float", {}))).toEqual({
      chromePolicy: "box",
      interaction: "numeric-drag"
    });
    expect(objectViewSpecForNode(node("core.int", {}))).toEqual({
      chromePolicy: "box",
      interaction: "numeric-drag"
    });
    expect(objectViewSpecForNode(node("core.uint", {}))).toEqual({
      chromePolicy: "box",
      interaction: "numeric-drag"
    });
    expect(objectViewSpecForNode(node("core.message", {}))).toEqual({
      chromePolicy: "box",
      interaction: "message-trigger"
    });
    expect(objectViewSpecForNode(node("core.bool", {}))).toEqual({
      chromePolicy: "box",
      interaction: "runtime-control"
    });
    expect(objectViewSpecForNode(node("core.color", {}))).toEqual({
      chromePolicy: "box",
      interaction: "runtime-control"
    });
    expect(objectViewSpecForNode(node("core.string", {}))).toEqual({
      chromePolicy: "box",
      interaction: "runtime-control"
    });
    expect(objectViewSpecForNode(node("core.video-asset", {}))).toEqual({
      chromePolicy: "box",
      interaction: "asset-pick"
    });
    expect(objectViewSpecForNode(node("render.output", {}))).toEqual({
      chromePolicy: "box",
      interaction: "layout-edit"
    });
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
