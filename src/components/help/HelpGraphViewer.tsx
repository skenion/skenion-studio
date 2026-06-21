import { useMemo } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type NodeTypes
} from "@xyflow/react";
import type { GraphDocumentV01 } from "@skenion/contracts";
import {
  isPatchDefinitionV02,
  patchDefinitionToDisplayGraph,
  type PatchDefinitionV02
} from "../../graph/patchLibrary";
import { createViewStateFromPositions } from "../../graph/projectDocument";
import { toReactFlowViewModel } from "../../graph/reactFlowAdapter";
import { ReactFlowNodeAdapter } from "../graph/ReactFlowNodeAdapter";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

export type HelpGraphViewerDocument = GraphDocumentV01 | PatchDefinitionV02;

export function HelpGraphViewer({ graph }: { graph: HelpGraphViewerDocument }) {
  const displayGraph = useMemo(() => helpGraphDisplayDocument(graph), [graph]);
  const viewState = useMemo(() => createViewStateFromPositions(displayGraph, {}), [displayGraph]);
  const viewModel = useMemo(() => toReactFlowViewModel(displayGraph, viewState), [displayGraph, viewState]);
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
        <Background color="var(--sk-grid-dot)" gap={20} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function helpGraphDisplayDocument(graph: HelpGraphViewerDocument): GraphDocumentV01 {
  return isPatchDefinitionV02(graph) ? patchDefinitionToDisplayGraph(graph) : graph;
}
