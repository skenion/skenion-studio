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

function GraphCanvasStory({
  initialGraph,
  initialPositions = {}
}: {
  initialGraph: GraphDocumentV01;
  initialPositions?: ViewPositions;
}) {
  const [graph, setGraph] = useState(initialGraph);
  const [positions, setPositions] = useState<ViewPositions>(initialPositions);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [, setConnectionCheck] = useState<ConnectionCheck | null>(null);
  const [, setPatches] = useState<GraphPatch[]>([]);

  return (
    <div style={{ height: "680px", width: "100vw" }}>
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
