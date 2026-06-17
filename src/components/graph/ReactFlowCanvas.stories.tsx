import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { GraphDocumentV01, ViewStateV01 } from "@skenion/contracts";
import { GraphCanvas } from "../GraphCanvas";
import {
  portDemoSampleGraph,
  portDemoSampleViewState,
  renderSampleGraph,
  sampleGraph,
  sendReceivePanelSampleGraph,
  sendReceivePanelSampleViewState,
  shaderMultiUniformSampleGraph,
  shaderMultiUniformSampleViewState,
  shaderUniformSampleGraph,
  shaderUniformSampleViewState
} from "../../data/sampleGraph";
import { createViewStateFromPositions, reconcileViewStateWithGraph } from "../../graph/projectDocument";
import type { ConnectionCheck, GraphPatch } from "../../graph/skenionGraph";

const meta = {
  title: "Graph/ReactFlowCanvas",
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const RenderOutputGraph: Story = {
  render: () => <GraphCanvasStory initialGraph={renderSampleGraph} />
};

export const ShaderUniformGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={shaderUniformSampleGraph}
      initialViewState={shaderUniformSampleViewState}
    />
  )
};

export const ShaderMultiUniformGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={shaderMultiUniformSampleGraph}
      initialViewState={shaderMultiUniformSampleViewState}
    />
  )
};

export const PortDemoGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={portDemoSampleGraph}
      initialViewState={portDemoSampleViewState}
    />
  )
};

export const SendReceivePanelGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={sendReceivePanelSampleGraph}
      initialViewState={sendReceivePanelSampleViewState}
    />
  )
};

export const SavedProjectLayoutGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={sendReceivePanelSampleGraph}
      initialViewState={createViewStateFromPositions(
        sendReceivePanelSampleGraph,
        {
          slider_speed: { x: 48, y: 72 },
          send_speed: { x: 330, y: 72 },
          receive_speed: { x: 330, y: 256 },
          toggle_enabled: { x: 48, y: 396 },
          send_enabled: { x: 330, y: 396 },
          receive_enabled: { x: 330, y: 580 },
          shader_1: { x: 676, y: 236 },
          output_1: { x: 1016, y: 296 }
        },
        { x: -24, y: -16, zoom: 0.92 }
      )}
    />
  )
};

export const CompatibilityGraph: Story = {
  render: () => <GraphCanvasStory initialGraph={sampleGraph} />
};

export const SelectedEdgeState: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={shaderUniformSampleGraph}
      initialViewState={shaderUniformSampleViewState}
      initialSelectedEdgeId="shader_1.out->output_1.in"
    />
  )
};

export const InvalidConnectionDiagnostic: Story = {
  render: () => (
    <GraphCanvasStory
      initialConnectionCheck={{
        ok: false,
        message:
          "incompatible-edge-type: value_1.value->output_1.in connects value.f32 to render.frame without an explicit adapter."
      }}
      initialGraph={shaderUniformSampleGraph}
      initialViewState={shaderUniformSampleViewState}
    />
  )
};

function GraphCanvasStory({
  initialGraph,
  initialConnectionCheck = null,
  initialViewState,
  initialSelectedEdgeId = null
}: {
  initialGraph: GraphDocumentV01;
  initialConnectionCheck?: ConnectionCheck | null;
  initialViewState?: ViewStateV01;
  initialSelectedEdgeId?: string | null;
}) {
  const [graph, setGraph] = useState(initialGraph);
  const [viewState, setViewState] = useState<ViewStateV01>(
    () => initialViewState ?? createViewStateFromPositions(initialGraph, {})
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(initialSelectedEdgeId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheck | null>(
    initialConnectionCheck
  );
  const [, setPatches] = useState<GraphPatch[]>([]);

  return (
    <div style={{ height: "680px", position: "relative", width: "100vw" }}>
      {connectionCheck ? (
        <div
          className={`storybook-diagnostic-card ${connectionCheck.ok ? "is-ok" : "is-error"}`}
          style={{
            background: "#ffffff",
            border: `1px solid ${connectionCheck.ok ? "#0ca678" : "#fa5252"}`,
            borderRadius: 8,
            boxShadow: "0 10px 24px rgb(31 41 51 / 14%)",
            color: "#1f2933",
            fontSize: 12,
            fontWeight: 700,
            left: 24,
            maxWidth: 520,
            padding: "10px 12px",
            position: "absolute",
            top: 24,
            zIndex: 10
          }}
        >
          {connectionCheck.message}
        </div>
      ) : null}
      <GraphCanvas
        graph={graph}
        onConnectionCheck={setConnectionCheck}
        onGraphChange={(nextGraph, patches = []) => {
          setGraph(nextGraph);
          setViewState((currentViewState) => reconcileViewStateWithGraph(nextGraph, currentViewState));
          setPatches(patches);
        }}
        onViewStateChange={setViewState}
        onSelectedEdgeChange={setSelectedEdgeId}
        onSelectedNodeChange={setSelectedNodeId}
        selectedEdgeId={selectedEdgeId}
        selectedNodeId={selectedNodeId}
        viewState={viewState}
      />
    </div>
  );
}
