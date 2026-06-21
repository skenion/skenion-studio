import { Tabs } from "@mantine/core";
import type { ReactNode } from "react";

export type StudioSidePanelTab = "runtime" | "inspect";

export const DEFAULT_STUDIO_SIDE_PANEL_TAB: StudioSidePanelTab = "runtime";

export function StudioSidePanel({
  activeTab,
  inspectPanel,
  onTabChange,
  runtimePanel
}: {
  activeTab: StudioSidePanelTab;
  inspectPanel: ReactNode;
  onTabChange: (tab: StudioSidePanelTab) => void;
  runtimePanel: ReactNode;
}) {
  return (
    <Tabs
      keepMounted={false}
      onChange={(value) => {
        if (value === "runtime" || value === "inspect") {
          onTabChange(value);
        }
      }}
      radius="sm"
      value={activeTab}
      variant="pills"
    >
      <Tabs.List grow>
        <Tabs.Tab value="runtime">Runtime</Tabs.Tab>
        <Tabs.Tab value="inspect">Inspect</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel pt="sm" value="runtime">
        {runtimePanel}
      </Tabs.Panel>
      <Tabs.Panel pt="sm" value="inspect">
        {inspectPanel}
      </Tabs.Panel>
    </Tabs>
  );
}

export function sidePanelTabForInspectableSelection({
  edgeId,
  helpNodeId,
  nodeId
}: {
  edgeId: string | null;
  helpNodeId: string | null;
  nodeId: string | null;
}): StudioSidePanelTab | null {
  return edgeId || helpNodeId || nodeId ? "inspect" : null;
}
