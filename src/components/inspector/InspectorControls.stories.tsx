import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "@mantine/core";
import { BooleanValueControls } from "./BooleanValueControls";
import { ClearColorControls } from "./ClearColorControls";
import { CommentControls } from "./CommentControls";
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
import { StringValueControls } from "./StringValueControls";
import {
  DEFAULT_FULLSCREEN_SHADER_SOURCE,
  analyzeFullscreenShaderInterface,
  portsForFullscreenShaderSource
} from "../../graph/fullscreenShader";
import { createGraphNodeFromDefinition } from "../../graph/skenionGraph";
import { nodeRegistry } from "../../data/registry";
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
const asyncNoop = async () => undefined;

export const NodeControls: Story = {
  render: () => (
    <InspectorShell edgeCount={1} nodeCount={2}>
      <NodeInspector
        node={renderSampleGraph.nodes[0]!}
        onRemoveNode={noop}
        onImportAsset={asyncNoop}
        onSendRuntimeControl={noop}
        onSetNodeParam={noop}
        onSyncShaderInputs={noop}
        runtimeAssetImportBusy={false}
        runtimeAssetImportEnabled={false}
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
  render: () => (
    <ColorRgbaControls
      color={[0.95, 0.25, 0.12, 1]}
      colorSpace="linear"
      onChange={noop}
      onColorSpaceChange={noop}
      onRepresentationChange={noop}
      representation="rgba32f"
    />
  )
};

export const FloatValueControl: Story = {
  render: () => <FloatValueControls value={0.2} onChange={noop} onRepresentationChange={noop} representation="f32" />
};

export const IntegerValueControl: Story = {
  render: () => <IntegerValueControls value={32} onChange={noop} onRepresentationChange={noop} representation="i32" />
};

export const BooleanValueControl: Story = {
  render: () => <BooleanValueControls value onChange={noop} />
};

export const StringValueControl: Story = {
  render: () => <StringValueControls value="ready" onChange={noop} />
};

export const CommentControl: Story = {
  render: () => <CommentControls text="Bang fans out to local control nodes." onChange={noop} />
};

export const RuntimeControlValueControl: Story = {
  render: () => (
    <RuntimeControlValueControls
      busy={false}
      enabled
      nodeId="value_1"
      onSend={noop}
      value={{ type: "float", representation: "f32", value: 1.25 }}
    />
  )
};

export const RuntimeControlMessageOnly: Story = {
  render: () => (
    <RuntimeControlValueControls
      availableActions={{ bang: true, in: false, set: false }}
      busy={false}
      enabled
      nodeId="message_1"
      onSend={noop}
      value={{ type: "string", value: "perform" }}
    />
  )
};

export const MessageNodeInspector: Story = {
  render: () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.message");
    return (
      <InspectorShell edgeCount={1} nodeCount={2}>
        <NodeInspector
          node={createGraphNodeFromDefinition(definition!, [])}
          onRemoveNode={noop}
          onImportAsset={asyncNoop}
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
};

export const FullscreenShaderControl: Story = {
  render: () => (
    <FullscreenShaderControls
      analysis={analyzeFullscreenShaderInterface(DEFAULT_FULLSCREEN_SHADER_SOURCE)}
      interfaceSynced={
        JSON.stringify(renderSampleGraph.nodes[0]!.ports) ===
        JSON.stringify(portsForFullscreenShaderSource(DEFAULT_FULLSCREEN_SHADER_SOURCE))
      }
      language="wgsl"
      onAnalyze={noop}
      onResetSource={noop}
      onSourceChange={noop}
      onSyncInputs={noop}
      source={DEFAULT_FULLSCREEN_SHADER_SOURCE}
    />
  )
};

export const FullscreenShaderDiagnostics: Story = {
  render: () => (
    <FullscreenShaderControls
      analysis={analyzeFullscreenShaderInterface(
        "// @skenion.uniform bad vec3\n@fragment\nfn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }"
      )}
      generatedShader={{
        ok: false,
        nodeId: "shader_1",
        language: "wgsl",
        source: "struct SkenionFrame {\n  resolution: vec2<f32>,\n}\n\n@fragment\nfn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(skenion.missingField, 0.0, 0.0, 1.0); }",
        sourceMap: {
          userSourceStartLine: 5,
          generatedLineOffset: 4
        },
        diagnostics: [
          {
            severity: "error",
            phase: "wgsl-compile",
            code: "wgsl-validation",
            message: "unknown field missingField on SkenionFrame",
            line: 6,
            column: 42,
            source: "generated"
          }
        ]
      }}
      initialGeneratedVisible
      interfaceSynced={false}
      language="wgsl"
      onAnalyze={noop}
      onLoadGeneratedShader={noop}
      onResetSource={noop}
      onSourceChange={noop}
      onSyncInputs={noop}
      runtimeDiagnostics={[
        {
          severity: "error",
          phase: "render-pipeline",
          code: "fullscreen-shader-initialization-failed",
          message: "failed to initialize fullscreen shader renderer",
          source: "runtime"
        }
      ]}
      source={
        "// @skenion.uniform bad vec3\n@fragment\nfn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }"
      }
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
