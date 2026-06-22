import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  DEFAULT_PANEL_COLOR,
  PANEL_NODE_KIND,
  defaultPanelParams,
  isPanelNode,
  readPanelParams
} from "./panelNode";

describe("panel graph helpers", () => {
  it("identifies panel nodes and creates default params", () => {
    const node = panelNode("Controls", "#00ff00");

    expect(isPanelNode(node)).toBe(true);
    expect(isPanelNode({ ...node, kind: "core.comment" })).toBe(false);
    expect(isPanelNode(null)).toBe(false);
    expect(defaultPanelParams()).toEqual({
      label: "Panel",
      color: DEFAULT_PANEL_COLOR
    });
  });

  it("reads panel params with color fallback", () => {
    expect(readPanelParams(panelNode("Tempo", "#11aa22"))).toEqual({
      label: "Tempo",
      color: "#11aa22"
    });
    expect(readPanelParams(panelNode("Blank", "transparent"))).toEqual({
      label: "Blank",
      color: "transparent"
    });
    expect(readPanelParams(panelNode(false, "green"))).toEqual({
      label: "",
      color: DEFAULT_PANEL_COLOR
    });
  });
});

function panelNode(label: unknown, color: unknown): GraphNodeV01 {
  return {
    id: "panel_1",
    kind: PANEL_NODE_KIND,
    kindVersion: "0.1.0",
    params: { label, color },
    ports: []
  };
}
