import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type NodeTypes
} from "@xyflow/react";
import type { GraphDocumentV01 } from "@skenion/contracts";
import { toReactFlowViewModel } from "../../graph/reactFlowAdapter";
import { ReactFlowNodeAdapter } from "../graph/ReactFlowNodeAdapter";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

export function HelpGraphViewer({ graph }: { graph: GraphDocumentV01 }) {
  const viewModel = useMemo(() => toReactFlowViewModel(graph, {}), [graph]);
  const nodes = useMemo(
    () =>
      viewModel.nodes.map((node) => ({
        ...node,
        connectable: false,
        draggable: false,
        selectable: false
      })),
    [viewModel.nodes]
  );
  const edges = useMemo(
    () =>
      viewModel.edges.map((edge) => ({
        ...edge,
        selectable: false
      })),
    [viewModel.edges]
  );

  return (
    <div className="help-graph-viewer">
      <ReactFlow
        className="skenion-flow help-flow"
        edges={edges}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        panOnDrag
        preventScrolling={false}
        zoomOnDoubleClick={false}
      >
        <Background color="#d8dee6" gap={20} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
