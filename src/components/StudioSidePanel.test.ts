import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STUDIO_SIDE_PANEL_TAB,
  StudioSidePanel,
  sidePanelTabForInspectableSelection
} from "./StudioSidePanel";

describe("StudioSidePanel", () => {
  it("defaults to Runtime as the primary side panel tab", () => {
    expect(DEFAULT_STUDIO_SIDE_PANEL_TAB).toBe("runtime");
  });

  it("renders Runtime tab content without Inspect details when Runtime is active", () => {
    const html = renderPanel("runtime");

    expect(html).toContain("Runtime Clock Sources");
    expect(html).not.toContain("Selected node details");
  });

  it("renders Inspect tab content without Runtime clock controls when Inspect is active", () => {
    const html = renderPanel("inspect");

    expect(html).toContain("Selected node details");
    expect(html).not.toContain("Runtime Clock Sources");
  });

  it("switches to Inspect for node, edge, or help selection", () => {
    expect(sidePanelTabForInspectableSelection({ edgeId: null, helpNodeId: null, nodeId: "node_1" })).toBe(
      "inspect"
    );
    expect(sidePanelTabForInspectableSelection({ edgeId: "edge_1", helpNodeId: null, nodeId: null })).toBe(
      "inspect"
    );
    expect(sidePanelTabForInspectableSelection({ edgeId: null, helpNodeId: "core.float", nodeId: null })).toBe(
      "inspect"
    );
    expect(sidePanelTabForInspectableSelection({ edgeId: null, helpNodeId: null, nodeId: null })).toBeNull();
  });
});

function renderPanel(activeTab: "runtime" | "inspect"): string {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(StudioSidePanel, {
        activeTab,
        inspectPanel: createElement("section", null, "Selected node details"),
        onTabChange: () => undefined,
        runtimePanel: createElement("section", null, "Runtime Clock Sources")
      })
    )
  );
}
