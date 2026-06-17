import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "@mantine/core";
import { BooleanValueControls } from "./BooleanValueControls";
import { ClearColorControls } from "./ClearColorControls";
import { ColorRgbaControls } from "./ColorRgbaControls";
import { ConnectionDiagnosticsPanel } from "./ConnectionDiagnosticsPanel";
import { EdgeInspector } from "./EdgeInspector";
import { FeedbackPolicyDialog } from "./FeedbackPolicyDialog";
import { FloatValueControls } from "./FloatValueControls";
import { FullscreenShaderControls } from "./FullscreenShaderControls";
import { GraphDiagnosticsPanel } from "./GraphDiagnosticsPanel";
import { InspectorShell } from "./InspectorShell";
import { IntegerValueControls } from "./IntegerValueControls";
import { NodeInspector } from "./NodeInspector";
import { RuntimeControlValueControls } from "./RuntimeControlValueControls";
import { DEFAULT_FULLSCREEN_SHADER_SOURCE } from "../../graph/fullscreenShader";
import { renderSampleGraph } from "../../data/sampleGraph";
import {
  edgeInspectorModel,
  feedbackEdgeInspectorModel,
  noop,
  semanticDiagnostics,
  validationFailed,
  validationOk
} from "../../stories/storyFixtures";

const meta = {
  title: "Inspector/Panels",
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

export const NodeControls: Story = {
  render: () => (
    <InspectorShell edgeCount={1} nodeCount={2}>
      <NodeInspector
        node={renderSampleGraph.nodes[0]!}
        onRemoveNode={noop}
        onSendRuntimeControl={noop}
        onSetNodeParam={noop}
        runtimeControlBusy={false}
        runtimeControlEnabled
      />
    </InspectorShell>
  )
};

export const ClearColorControl: Story = {
  render: () => <ClearColorControls color={[0.1, 0.36, 0.84, 1]} onChange={noop} />
};

export const ColorRgbaControl: Story = {
  render: () => <ColorRgbaControls color={[0.95, 0.25, 0.12, 1]} onChange={noop} />
};

export const FloatValueControl: Story = {
  render: () => <FloatValueControls value={0.2} onChange={noop} />
};

export const IntegerValueControl: Story = {
  render: () => <IntegerValueControls value={32} onChange={noop} />
};

export const BooleanValueControl: Story = {
  render: () => <BooleanValueControls value onChange={noop} />
};

export const RuntimeControlValueControl: Story = {
  render: () => (
    <RuntimeControlValueControls
      busy={false}
      enabled
      nodeId="value_1"
      onSend={noop}
      value={{ type: "f32", value: 1.25 }}
    />
  )
};

export const FullscreenShaderControl: Story = {
  render: () => (
    <FullscreenShaderControls
      language="wgsl"
      onResetSource={noop}
      onSourceChange={noop}
      source={DEFAULT_FULLSCREEN_SHADER_SOURCE}
    />
  )
};

export const ValidationPanel: Story = {
  render: () => (
    <Stack gap="sm">
      <GraphDiagnosticsPanel semanticDiagnostics={[]} validation={validationOk} />
      <GraphDiagnosticsPanel
        semanticDiagnostics={semanticDiagnostics}
        validation={validationFailed}
      />
      <ConnectionDiagnosticsPanel
        connectionCheck={{
          ok: false,
          message: "fan-in-forbidden: render.output.in accepts one render.frame input"
        }}
      />
    </Stack>
  )
};

export const EdgeInspectorDefault: Story = {
  render: () => (
    <EdgeInspector diagnostics={[]} edge={edgeInspectorModel} onOpenFeedbackDialog={noop} />
  )
};

export const EdgeInspectorFeedback: Story = {
  render: () => (
    <EdgeInspector
      diagnostics={semanticDiagnostics}
      edge={feedbackEdgeInspectorModel}
      onOpenFeedbackDialog={noop}
    />
  )
};

export const FeedbackDialogOpen: Story = {
  render: () => (
    <FeedbackPolicyDialog edge={feedbackEdgeInspectorModel} onClose={noop} opened />
  )
};
