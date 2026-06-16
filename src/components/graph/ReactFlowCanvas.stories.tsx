import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import type { GraphDocumentV01 } from "@skenion/contracts";
import { GraphCanvas } from "../GraphCanvas";
import {
  portDemoSampleGraph,
  portDemoSamplePositions,
  renderSampleGraph,
  sampleGraph,
  shaderUniformSampleGraph,
  shaderUniformSamplePositions
} from "../../data/sampleGraph";
import type { ConnectionCheck, GraphPatch, ViewPositions } from "../../graph/skenionGraph";

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
      initialPositions={shaderUniformSamplePositions}
    />
  )
};

export const PortDemoGraph: Story = {
  render: () => (
    <GraphCanvasStory
      initialGraph={portDemoSampleGraph}
      initialPositions={portDemoSamplePositions}
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
      initialPositions={shaderUniformSamplePositions}
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
      initialPositions={shaderUniformSamplePositions}
    />
  )
};

function GraphCanvasStory({
  initialGraph,
  initialConnectionCheck = null,
  initialPositions = {},
  initialSelectedEdgeId = null
}: {
  initialGraph: GraphDocumentV01;
  initialConnectionCheck?: ConnectionCheck | null;
  initialPositions?: ViewPositions;
  initialSelectedEdgeId?: string | null;
}) {
  const [graph, setGraph] = useState(initialGraph);
  const [positions, setPositions] = useState<ViewPositions>(initialPositions);
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
          setPatches(patches);
        }}
        onPositionsChange={setPositions}
        onSelectedEdgeChange={setSelectedEdgeId}
        onSelectedNodeChange={setSelectedNodeId}
        positions={positions}
        selectedEdgeId={selectedEdgeId}
        selectedNodeId={selectedNodeId}
      />
    </div>
  );
}
