import type { Meta, StoryObj } from "@storybook/react-vite";
import { Divider, Stack } from "@mantine/core";
import { RuntimePanel } from "../RuntimePanel";
import { RuntimeConnectionPanel } from "./RuntimeConnectionPanel";
import { RuntimeHistoryPanel } from "./RuntimeHistoryPanel";
import { RuntimePatchPanel } from "./RuntimePatchPanel";
import { RuntimePreviewPanel } from "./RuntimePreviewPanel";
import { RuntimeSessionPanel } from "./RuntimeSessionPanel";
import { RuntimeTelemetryPanel } from "./RuntimeTelemetryPanel";
import {
  latestHistoryEvents,
  runtimeHistoryActionAvailability
} from "../../runtime/historySync";
import {
  noop,
  runtimeHistory,
  runtimeInfo,
  runtimePreviewStatus,
  runtimeSession,
  runtimeTelemetry,
  runtimeTelemetryWithRenderError
} from "../../stories/storyFixtures";

const meta = {
  title: "Runtime/Panels",
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  render: () => (
    <RuntimeConnectionPanel
      busyAction={null}
      connected={false}
      onConnect={noop}
      onRefreshSession={noop}
      onUrlChange={noop}
      status="disconnected"
      url="http://localhost:3761"
    />
  )
};

export const ConnectionAndSession: Story = {
  render: () => (
    <Stack gap="sm">
      <RuntimeConnectionPanel
        busyAction={null}
        connected
        onConnect={noop}
        onRefreshSession={noop}
        onUrlChange={noop}
        status="connected"
        url="http://localhost:3761"
      />
      <Divider />
      <RuntimeSessionPanel
        busyAction={null}
        connected
        onClearSession={noop}
        onLoadSession={noop}
        onPlanSession={noop}
        onRunSession={noop}
        onValidateSession={noop}
        session={runtimeSession}
        sessionLoaded
        sessionSynced={false}
      />
    </Stack>
  )
};

export const PreviewTelemetry: Story = {
  render: () => (
    <Stack gap="sm">
      <RuntimePreviewPanel
        busyAction={null}
        connected
        onRefreshPreview={noop}
        onRestartPreview={noop}
        onStartPreview={noop}
        onStopPreview={noop}
        previewStatus={runtimePreviewStatus}
        sessionLoaded
      />
      <RuntimeTelemetryPanel telemetry={runtimeTelemetry} />
    </Stack>
  )
};

export const PatchPending: Story = {
  render: () => (
    <RuntimePatchPanel
      busyAction={null}
      connected
      onApplyPendingPatch={noop}
      onClearPendingPatch={noop}
      patchBaseRevision="7"
      patchConflict={null}
      pendingPatchOps={2}
      sessionLoaded
    />
  )
};

export const PatchConflict: Story = {
  render: () => (
    <RuntimePatchPanel
      busyAction={null}
      connected
      onApplyPendingPatch={noop}
      onClearPendingPatch={noop}
      patchBaseRevision="6"
      patchConflict="patch baseRevision 6 does not match session graph revision 7"
      pendingPatchOps={2}
      sessionLoaded
    />
  )
};

export const TelemetryRenderError: Story = {
  render: () => <RuntimeTelemetryPanel telemetry={runtimeTelemetryWithRenderError} />
};

export const HistoryControls: Story = {
  render: () => (
    <RuntimeHistoryPanel
      busyAction={null}
      connected
      history={runtimeHistory}
      historyAvailability={runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: true,
        pendingPatchOps: 0,
        history: runtimeHistory
      })}
      latestEvents={latestHistoryEvents(runtimeHistory, 3)}
      onRedoPatch={noop}
      onRefreshHistory={noop}
      onUndoPatch={noop}
      sessionLoaded
    />
  )
};

export const FullRuntimePanel: Story = {
  render: () => (
    <RuntimePanel
      busyAction={null}
      error={null}
      frames={12}
      history={runtimeHistory}
      info={runtimeInfo}
      onApplyPendingPatch={noop}
      onClearPendingPatch={noop}
      onClearSession={noop}
      onConnect={noop}
      onFramesChange={noop}
      onLoadSession={noop}
      onPlan={noop}
      onPlanSession={noop}
      onRedoPatch={noop}
      onRefreshHistory={noop}
      onRefreshPreview={noop}
      onRefreshSession={noop}
      onRestartPreview={noop}
      onRun={noop}
      onRunSession={noop}
      onStartPreview={noop}
      onStopPreview={noop}
      onUndoPatch={noop}
      onUrlChange={noop}
      onValidate={noop}
      onValidateSession={noop}
      patchBaseRevision="7"
      patchConflict={null}
      pendingPatchOps={1}
      previewStatus={runtimePreviewStatus}
      result={null}
      session={runtimeSession}
      sessionSynced={false}
      status="connected"
      telemetry={runtimeTelemetry}
      url="http://localhost:3761"
    />
  )
};
