import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  defaultBangParams,
  DEFAULT_BANG_RADIUS,
  defaultSliderFloatParams,
  defaultToggleControlParams,
  isBangControlNode,
  isSliderFloatNode,
  isToggleControlNode,
  readBangParams,
  readPanelLabelParam,
  readSliderFloatParams,
  runtimeControlValueForPanelNode
} from "./panelControls";

describe("panel control graph helpers", () => {
  it("reads slider and toggle widgets from canonical value nodes", () => {
    const slider = node("core.float", {
      label: "Speed",
      value: 1.5,
      min: 0,
      max: 2,
      step: 0.01,
      widget: "slider"
    });
    const toggle = node("core.bool", { label: "Enabled", value: true, widget: "toggle" });

    expect(isSliderFloatNode(slider)).toBe(true);
    expect(isToggleControlNode(toggle)).toBe(true);
    expect(isToggleControlNode(node("core.bool", { widget: "checkbox" }))).toBe(true);
    expect(isToggleControlNode(node("core.bool", { widget: "button" }))).toBe(false);
    expect(readSliderFloatParams(slider)).toEqual({
      label: "Speed",
      value: 1.5,
      min: 0,
      max: 2,
      step: 0.01
    });
    expect(runtimeControlValueForPanelNode(slider)).toEqual({ type: "float", representation: "f32", value: 1.5 });
    expect(runtimeControlValueForPanelNode(toggle)).toEqual({ type: "bool", value: true });
    expect(runtimeControlValueForPanelNode(node("core.bang", {}))).toBeNull();
    expect(runtimeControlValueForPanelNode(node("core.float", {}))).toBeNull();
    expect(isBangControlNode(node("core.bang", {}))).toBe(true);
    expect(isBangControlNode(null)).toBe(false);
  });

  it("provides defaults and fallback panel params", () => {
    expect(defaultBangParams()).toEqual({ label: "Bang", radius: DEFAULT_BANG_RADIUS });
    expect(defaultSliderFloatParams()).toEqual({
      label: "Value",
      max: 1,
      min: 0,
      step: 0.01,
      value: 0,
      widget: "slider"
    });
    expect(defaultToggleControlParams()).toEqual({ label: "Enabled", value: false, widget: "toggle" });
    expect(readPanelLabelParam(node("core.bang", {}))).toBe("node_1");
    expect(readPanelLabelParam(node("core.bang", { label: "" }))).toBe("node_1");
    expect(readBangParams(node("core.bang", { radius: 0 }))).toEqual({ label: "node_1", radius: "0px" });
    expect(readBangParams(node("core.bang", { radius: "0" }))).toEqual({ label: "node_1", radius: "0px" });
    expect(readBangParams(node("core.bang", { label: "Fire", radius: "50%" }))).toEqual({ label: "Fire", radius: "50%" });
    expect(readBangParams(node("core.bang", { radius: null }))).toEqual({ label: "node_1", radius: DEFAULT_BANG_RADIUS });
    expect(readBangParams(node("core.bang", { radius: "bad" }))).toEqual({ label: "node_1", radius: DEFAULT_BANG_RADIUS });
    expect(readSliderFloatParams(node("core.float", { value: "bad", min: 2, max: 1, step: 0, widget: "slider" }))).toEqual({
      label: "node_1",
      value: 0,
      min: 2,
      max: 3,
      step: 0.01
    });
    expect(runtimeControlValueForPanelNode(node("core.bool", { value: "bad", widget: "toggle" }))).toEqual({
      type: "bool",
      value: false
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
