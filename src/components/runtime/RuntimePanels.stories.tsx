import type { Meta, StoryObj } from "@storybook/react-vite";
import { Divider, Stack } from "@mantine/core";
import type { ClockStateV01 } from "../../runtime/types";
import { RuntimeLogsPanel, RuntimeSettingsPanel } from "../RuntimePanel";
import { sampleGraph } from "../../data/sampleGraph";
import { ClockStateDisplay } from "./ClockStateDisplay";
import { RuntimeConnectionPanel } from "./RuntimeConnectionPanel";
import { RuntimePreviewPanel } from "./RuntimePreviewPanel";
import { RuntimeSessionPanel } from "./RuntimeSessionPanel";
import { RuntimeTelemetryPanel } from "./RuntimeTelemetryPanel";
import {
  noop,
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

export const TelemetryRenderError: Story = {
  render: () => <RuntimeTelemetryPanel telemetry={runtimeTelemetryWithRenderError} />
};

export const RuntimeSettings: Story = {
  render: () => (
    <RuntimeSettingsPanel
      busyAction={null}
      error={null}
      info={runtimeInfo}
      onClearSession={noop}
      onConnect={noop}
      onPlanSession={noop}
      onRefreshPreview={noop}
      onRefreshSession={noop}
      onRestartPreview={noop}
      onRunSession={noop}
      onStartPreview={noop}
      onStopPreview={noop}
      onUrlChange={noop}
      onValidateSession={noop}
      previewStatus={runtimePreviewStatus}
      result={null}
      session={runtimeSession}
      sessionSynced={false}
      status="connected"
      url="http://localhost:3761"
    />
  )
};

export const RuntimeLogs: Story = {
  render: () => (
    <RuntimeLogsPanel
      clientLines={[]}
      error={null}
      info={runtimeInfo}
      previewStatus={runtimePreviewStatus}
      result={null}
      runtimeLines={[]}
      semanticDiagnostics={[]}
      session={runtimeSession}
      status="connected"
      telemetry={runtimeTelemetry}
      validation={{ ok: true, value: sampleGraph }}
    />
  )
};

export const ClockStateMixedAuthority: Story = {
  render: () => <ClockStateDisplay state={clockState()} />
};

export const ClockStateBarUnavailable: Story = {
  render: () => (
    <ClockStateDisplay
      state={{
        ...clockState(),
        bar: { authority: "unavailable", source: "clock-node-main", value: null },
        beat: { authority: "unavailable", source: "clock-node-main", value: null },
        division: { authority: "unavailable", source: "clock-node-main", value: null },
        timeSignature: { authority: "unavailable", source: "clock-node-main", value: null }
      }}
    />
  )
};

function clockState(sourceId = "clock-node-main"): ClockStateV01 {
  return {
    bar: { authority: "derived", source: sourceId, value: 37 },
    beat: { authority: "derived", source: sourceId, value: 2 },
    capabilities: ["running", "tick", "ppq-position", "song-position", "bar-beat", "time-signature"],
    division: { authority: "derived", source: sourceId, value: 3 },
    lastUpdateHostTimeNs: 123456789,
    phase01: { authority: "derived", source: sourceId, value: 0.5 },
    ppqPosition: { authority: "derived", source: sourceId, value: 145.5 },
    running: { authority: "authoritative", source: sourceId, value: true },
    sampleFrame: { authority: "unavailable", source: sourceId, value: null },
    sampleRate: { authority: "unavailable", source: sourceId, value: null },
    songPositionSixteenth: { authority: "authoritative", source: sourceId, value: 581 },
    sourceId,
    sourceKind: "midi-clock",
    tempoBpm: { authority: "unavailable", source: sourceId, value: null },
    tickIndex: { authority: "authoritative", source: sourceId, value: 3486 },
    timeSeconds: { authority: "unavailable", source: sourceId, value: null },
    timeSignature: { authority: "authoritative", source: sourceId, value: { numerator: 4, denominator: 4 } },
    timecode: { authority: "unavailable", source: sourceId, value: null }
  };
}
