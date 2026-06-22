import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { ViewStateV01 } from "@skenion/contracts";
import { GraphCanvas } from "../GraphCanvas";
import {
  portDemoSampleGraph,
  portDemoSampleViewState,
  renderSampleGraph,
  sampleGraph,
  objectRoutingPanelSampleGraph,
  objectRoutingPanelSampleViewState,
  objectVisualSampleGraph,
  objectVisualSampleViewState,
  shaderMultiUniformSampleGraph,
  shaderMultiUniformSampleViewState,
  shaderUniformSampleGraph,
  shaderUniformSampleViewState
} from "../../data/sampleGraph";
import { createViewStateFromPositions, reconcileViewStateWithGraph } from "../../graph/projectDocument";
import type { DisplayGraphDocumentV01 } from "../../graph/patchLibrary";
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

export const ObjectRoutingPanelGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={objectRoutingPanelSampleGraph}
      initialViewState={objectRoutingPanelSampleViewState}
    />
  )
};

export const SavedProjectLayoutGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={objectRoutingPanelSampleGraph}
      initialViewState={createViewStateFromPositions(
        objectRoutingPanelSampleGraph,
        {
          slider_speed: { x: 48, y: 72 },
          toggle_enabled: { x: 48, y: 236 },
          shader_1: { x: 390, y: 146 },
          output_1: { x: 730, y: 206 }
        },
        { x: -24, y: -16, zoom: 0.92 }
      )}
    />
  )
};

export const ObjectVisualObjectsGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={objectVisualSampleGraph}
      initialViewState={objectVisualSampleViewState}
    />
  )
};

export const CurrentSampleGraph: Story = {
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
          "incompatible-edge-type: value_1.value->output_1.in connects value.number.float to render.frame without an explicit adapter."
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
  initialGraph: DisplayGraphDocumentV01;
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
