import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes
} from "@xyflow/react";
import type { GraphDocumentV01, GraphFragmentV02, ViewStateV01 } from "@skenion/contracts";
import {
  isPatchDefinitionV02,
  patchDefinitionToDisplayGraph,
  type PatchDefinitionV02
} from "../../graph/patchLibrary";
import { createViewStateFromPositions } from "../../graph/projectDocument";
import { toReactFlowViewModel } from "../../graph/reactFlowAdapter";
import { ReactFlowNodeAdapter } from "../graph/ReactFlowNodeAdapter";
import {
  createGraphFragmentFromSelection,
  type GraphFragmentBuildResult,
  serializeGraphFragmentClipboard
} from "../../graph/fragmentClipboard";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

export type HelpGraphViewerDocument = GraphDocumentV01 | PatchDefinitionV02;

export function HelpGraphViewer({
  graph,
  onClipboardWriteError,
  onCopyFragment,
  onCopyFragmentError
}: {
  graph: HelpGraphViewerDocument;
  onClipboardWriteError?: (message: string) => void;
  onCopyFragment?: (fragment: GraphFragmentV02, result: GraphFragmentBuildResult) => void;
  onCopyFragmentError?: (message: string) => void;
}) {
  const displayGraph = useMemo(() => helpGraphDisplayDocument(graph), [graph]);
  const viewState = useMemo(() => createViewStateFromPositions(displayGraph, {}), [displayGraph]);
  const viewModel = useMemo(() => toReactFlowViewModel(displayGraph, viewState), [displayGraph, viewState]);
  const [selection, setSelection] = useState<{ edgeIds: string[]; nodeIds: string[] }>({
    edgeIds: [],
    nodeIds: []
  });
  const nodes = useMemo(
    () =>
      viewModel.nodes.map((node) => ({
        ...node,
        connectable: false,
        draggable: false,
        selectable: true
      })),
    [viewModel.nodes]
  );
  const edges = useMemo(
    () =>
      viewModel.edges.map((edge) => ({
        ...edge,
        selectable: true
      })),
    [viewModel.edges]
  );
  const copySelection = useCallback(async () => {
    const result = createGraphFragmentFromSelection(displayGraph, viewState, selection, {
      source: "help-source"
    });
    if (!result.fragment) {
      onCopyFragmentError?.(result.diagnostics[0]?.message ?? "No help graph fragment could be copied.");
      return;
    }
    onCopyFragment?.(result.fragment, result);
    if (!navigator.clipboard?.writeText) {
      onClipboardWriteError?.("Browser clipboard is unavailable; Studio kept the help fragment in memory.");
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeGraphFragmentClipboard(result.fragment));
    } catch {
      onClipboardWriteError?.("Browser clipboard write failed; Studio kept the help fragment in memory.");
    }
  }, [displayGraph, onClipboardWriteError, onCopyFragment, onCopyFragmentError, selection, viewState]);

  return (
    <div
      className="help-graph-viewer"
      onKeyDown={(event) => {
        const primaryModifier = event.metaKey || event.ctrlKey;
        if (!primaryModifier || event.altKey || event.shiftKey || event.key.toLowerCase() !== "c") {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        void copySelection();
      }}
      tabIndex={0}
    >
      <ReactFlow
        className="skenion-flow help-flow"
        edges={edges}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.22 }}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        onSelectionChange={({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
          setSelection({
            edgeIds: selectedEdges.map((edge) => edge.id),
            nodeIds: selectedNodes.map((node) => node.id)
          });
        }}
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

export interface VolatileHelpWorkingCopy {
  graph: GraphDocumentV01;
  readonlySource: false;
  sourceGraph: GraphDocumentV01;
  sourcePatchId?: string;
  viewState: ViewStateV01;
  volatile: true;
  workingCopyId: string;
}

export function createVolatileHelpWorkingCopy(
  sourceGraph: HelpGraphViewerDocument,
  options: { sourcePatchId?: string; workingCopyId?: string } = {}
): VolatileHelpWorkingCopy {
  const sourceDisplayGraph = helpGraphDisplayDocument(sourceGraph);
  const graph = cloneGraph(sourceDisplayGraph);
  const workingCopyId = options.workingCopyId ?? `${graph.id}-help-working-copy-${Date.now()}`;
  const editableGraph: GraphDocumentV01 = {
    ...graph,
    id: workingCopyId,
    revision: "1"
  };
  return {
    graph: editableGraph,
    readonlySource: false,
    sourceGraph: sourceDisplayGraph,
    sourcePatchId: options.sourcePatchId,
    viewState: createViewStateFromPositions(editableGraph, {}),
    volatile: true,
    workingCopyId
  };
}

function cloneGraph(graph: GraphDocumentV01): GraphDocumentV01 {
  return JSON.parse(JSON.stringify(graph)) as GraphDocumentV01;
}
