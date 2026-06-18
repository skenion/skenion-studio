import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  defaultUiButtonParams,
  defaultUiSliderF32Params,
  defaultUiToggleParams,
  isUiButtonNode,
  isUiSliderF32Node,
  isUiToggleNode,
  readPanelLabelParam,
  readUiSliderParams,
  runtimeControlValueForUiNode
} from "./panelControls";

describe("panel control graph helpers", () => {
  it("reads slider and toggle params for runtime controls", () => {
    const slider = node("ui.slider-f32", {
      label: "Speed",
      value: 1.5,
      min: 0,
      max: 2,
      step: 0.01
    });
    const toggle = node("ui.toggle", { label: "Enabled", value: true });

    expect(isUiSliderF32Node(slider)).toBe(true);
    expect(isUiToggleNode(toggle)).toBe(true);
    expect(readUiSliderParams(slider)).toEqual({
      label: "Speed",
      value: 1.5,
      min: 0,
      max: 2,
      step: 0.01
    });
    expect(runtimeControlValueForUiNode(slider)).toEqual({ type: "f32", value: 1.5 });
    expect(runtimeControlValueForUiNode(toggle)).toEqual({ type: "bool", value: true });
    expect(runtimeControlValueForUiNode(node("ui.button", {}))).toBeNull();
    expect(runtimeControlValueForUiNode(node("core.value-f32", {}))).toBeNull();
    expect(isUiButtonNode(node("ui.button", {}))).toBe(true);
    expect(isUiButtonNode(null)).toBe(false);
  });

  it("provides defaults and fallback panel params", () => {
    expect(defaultUiButtonParams()).toEqual({ label: "Bang" });
    expect(defaultUiSliderF32Params()).toEqual({ label: "Value", value: 0, min: 0, max: 1, step: 0.01 });
    expect(defaultUiToggleParams()).toEqual({ label: "Enabled", value: false });
    expect(readPanelLabelParam(node("ui.button", {}))).toBe("node_1");
    expect(readPanelLabelParam(node("ui.button", { label: "" }))).toBe("node_1");
    expect(readUiSliderParams(node("ui.slider-f32", { value: "bad", min: 2, max: 1, step: 0 }))).toEqual({
      label: "node_1",
      value: 0,
      min: 2,
      max: 3,
      step: 0.01
    });
    expect(runtimeControlValueForUiNode(node("ui.toggle", { value: "bad" }))).toEqual({
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
