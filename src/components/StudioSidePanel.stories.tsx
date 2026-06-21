import type { Meta, StoryObj } from "@storybook/react-vite";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import type {
  ClockSourceListResponse,
  ClockSourceSnapshot,
  ClockSourceSnapshotResponse,
  ClockStateV01,
  MidiClockSourceStartRequest,
  MidiClockSourceStartResponse,
  MidiClockSourceStopRequest,
  MidiClockSourceStopResponse,
  MidiInputListResponse
} from "../runtime/types";
import { renderSampleGraph } from "../data/sampleGraph";
import { edgeInspectorModel, noop, semanticDiagnostics } from "../stories/storyFixtures";
import { EdgeInspector } from "./inspector/EdgeInspector";
import { InspectorShell } from "./inspector/InspectorShell";
import { NodeHelp } from "./inspector/NodeHelp";
import { NodeInspector } from "./inspector/NodeInspector";
import { ClockSourcesPanel } from "./runtime/ClockSourcesPanel";
import { StudioSidePanel } from "./StudioSidePanel";

const meta = {
  title: "Studio/SidePanel",
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
} satisfies Meta<typeof StudioSidePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RuntimeNoDevices: Story = {
  render: () => (
    <StudioSidePanel
      activeTab="runtime"
      inspectPanel={<NodeInspectPanel />}
      onTabChange={noop}
      runtimePanel={<RuntimeClockPanel inputs={[]} sources={[]} />}
    />
  )
};

export const RuntimeRunning: Story = {
  render: () => (
    <StudioSidePanel
      activeTab="runtime"
      inspectPanel={<NodeInspectPanel />}
      onTabChange={noop}
      runtimePanel={
        <RuntimeClockPanel
          inputs={[
            {
              backend: "midir",
              id: null,
              index: 0,
              name: "USB MIDI Interface",
              stable: false
            }
          ]}
          sources={[runningMidiSource()]}
        />
      }
    />
  )
};

export const RuntimeDiagnostic: Story = {
  render: () => (
    <StudioSidePanel
      activeTab="runtime"
      inspectPanel={<NodeInspectPanel />}
      onTabChange={noop}
      runtimePanel={
        <RuntimeClockPanel
          diagnostics={[
            {
              code: "invalid-midi-input-port",
              message: "MIDI input port index is not available.",
              severity: "error"
            }
          ]}
          inputs={[]}
          sources={[]}
        />
      }
    />
  )
};

export const InspectNode: Story = {
  render: () => (
    <StudioSidePanel
      activeTab="inspect"
      inspectPanel={<NodeInspectPanel />}
      onTabChange={noop}
      runtimePanel={<RuntimeClockPanel inputs={[]} sources={[]} />}
    />
  )
};

export const InspectEdge: Story = {
  render: () => (
    <StudioSidePanel
      activeTab="inspect"
      inspectPanel={
        <InspectorShell edgeCount={1} nodeCount={2}>
          <EdgeInspector diagnostics={semanticDiagnostics} edge={edgeInspectorModel} onOpenFeedbackDialog={noop} />
        </InspectorShell>
      }
      onTabChange={noop}
      runtimePanel={<RuntimeClockPanel inputs={[]} sources={[]} />}
    />
  )
};

export const InspectHelp: Story = {
  render: () => (
    <StudioSidePanel
      activeTab="inspect"
      inspectPanel={
        <InspectorShell edgeCount={1} nodeCount={2}>
          <NodeHelp help={getRequiredHelp("core.float")} helpGraph={getBuiltinNodeHelpGraph("core.float")} />
        </InspectorShell>
      }
      onTabChange={noop}
      runtimePanel={<RuntimeClockPanel inputs={[]} sources={[]} />}
    />
  )
};

function RuntimeClockPanel({
  diagnostics = [],
  inputs,
  sources
}: {
  diagnostics?: Parameters<typeof ClockSourcesPanel>[0]["initialDiagnostics"];
  inputs: Parameters<typeof ClockSourcesPanel>[0]["initialInputs"];
  sources: Parameters<typeof ClockSourcesPanel>[0]["initialSources"];
}) {
  return (
    <ClockSourcesPanel
      connected
      initialDiagnostics={diagnostics}
      initialInputs={inputs}
      initialSources={sources}
      {...clockApiHandlers}
    />
  );
}

function NodeInspectPanel() {
  return (
    <InspectorShell edgeCount={1} nodeCount={2}>
      <NodeInspector
        graphLocked={false}
        node={renderSampleGraph.nodes[0]!}
        onImportAsset={async () => undefined}
        onRemoveNode={noop}
        onSendRuntimeControl={noop}
        onSetNodeParam={noop}
        onSyncShaderInputs={noop}
        runtimeAssetImportBusy={false}
        runtimeAssetImportEnabled={false}
        runtimeControlBusy={false}
        runtimeControlEnabled
      />
    </InspectorShell>
  );
}

const clockApiHandlers = {
  onGetClockSource: async (sourceId: string): Promise<ClockSourceSnapshotResponse> => ({
    diagnostics: [],
    ok: true,
    source: runningMidiSource(sourceId)
  }),
  onListClockSources: async (): Promise<ClockSourceListResponse> => ({
    diagnostics: [],
    ok: true,
    sources: [runningMidiSource()]
  }),
  onListMidiInputs: async (): Promise<MidiInputListResponse> => ({
    diagnostics: [],
    inputs: [],
    ok: true
  }),
  onStartMidiClockSource: async (
    request: MidiClockSourceStartRequest
  ): Promise<MidiClockSourceStartResponse> => ({
    diagnostics: [],
    ok: true,
    source: runningMidiSource(request.sourceId)
  }),
  onStopMidiClockSource: async (
    request: MidiClockSourceStopRequest
  ): Promise<MidiClockSourceStopResponse> => ({
    diagnostics: [],
    ok: true,
    source: {
      ...runningMidiSource(request.sourceId),
      status: "stopped"
    }
  })
};

function runningMidiSource(sourceId = "midi-clock-main"): ClockSourceSnapshot {
  return {
    diagnostics: [],
    latestSnapshot: clockState(sourceId),
    sourceId,
    sourceKind: "midi-clock",
    status: "running"
  };
}

function clockState(sourceId = "midi-clock-main"): ClockStateV01 {
  return {
    bar: { authority: "derived", source: sourceId, value: 37 },
    beat: { authority: "derived", source: sourceId, value: 2 },
    capabilities: ["running", "tick", "ppq-position", "song-position", "bar-beat", "time-signature"],
    division: { authority: "derived", source: sourceId, value: 1 },
    lastUpdateHostTimeNs: 5020000000,
    phase01: { authority: "derived", source: sourceId, value: 0.25 },
    ppqPosition: { authority: "derived", source: sourceId, value: 146.25 },
    running: { authority: "authoritative", source: sourceId, value: true },
    sampleFrame: { authority: "unavailable", source: sourceId, value: null },
    sampleRate: { authority: "unavailable", source: sourceId, value: null },
    songPositionSixteenth: { authority: "authoritative", source: sourceId, value: 585 },
    sourceId,
    sourceKind: "midi-clock",
    tempoBpm: { authority: "unavailable", source: sourceId, value: null },
    tickIndex: { authority: "authoritative", source: sourceId, value: 3510 },
    timeSeconds: { authority: "unavailable", source: sourceId, value: null },
    timeSignature: { authority: "authoritative", source: sourceId, value: { numerator: 4, denominator: 4 } },
    timecode: { authority: "unavailable", source: sourceId, value: null }
  };
}

function getRequiredHelp(id: string) {
  const help = getBuiltinNodeHelp(id);
  if (!help) {
    throw new Error(`Missing builtin help ${id}`);
  }
  return help;
}
