import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes
} from "@xyflow/react";
import type { GraphDocumentV01 } from "@skenion/contracts";
import { CanvasNode } from "./CanvasNode";
import {
  applyPatch,
  checkConnection,
  edgeFromReactFlow,
  toSkenionPatch,
  type GraphPatch,
  type ConnectionCheck,
  type ViewPositions
} from "../graph/skenionGraph";
import {
  toReactFlowViewModel
} from "../graph/reactFlowAdapter";

const nodeTypes: NodeTypes = {
  skenion: CanvasNode
};

interface GraphCanvasProps {
  graph: GraphDocumentV01;
  positions: ViewPositions;
  selectedNodeId: string | null;
  onConnectionCheck: (check: ConnectionCheck | null) => void;
  onGraphChange: (graph: GraphDocumentV01, patches?: GraphPatch[]) => void;
  onPositionsChange: (positions: ViewPositions) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
}

export function GraphCanvas({
  graph,
  positions,
  selectedNodeId,
  onConnectionCheck,
  onGraphChange,
  onPositionsChange,
  onSelectedNodeChange
}: GraphCanvasProps) {
  const viewModel = useMemo(() => toReactFlowViewModel(graph, positions), [graph, positions]);
  const [nodes, setNodes, onNodesChange] = useNodesState(viewModel.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(viewModel.edges);
  const deletingNodeIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setNodes(viewModel.nodes);
    setEdges(viewModel.edges);
  }, [setEdges, setNodes, viewModel.edges, viewModel.nodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const patch = toSkenionPatch(connection);
      const check = checkConnection(graph, patch);
      onConnectionCheck(check);
      if (!check.ok || !patch) {
        return;
      }

      onGraphChange(applyPatch(graph, patch), [patch]);
    },
    [graph, onConnectionCheck, onGraphChange]
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      onPositionsChange({
        ...positions,
        [node.id]: node.position
      });
    },
    [onPositionsChange, positions]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      let nextGraph = graph;
      const patches: GraphPatch[] = [];
      for (const edge of deletedEdges) {
        if (deletingNodeIdsRef.current.has(edge.source) || deletingNodeIdsRef.current.has(edge.target)) {
          continue;
        }
        const skenionEdge = edgeFromReactFlow(edge);
        if (skenionEdge) {
          const patch = { type: "removeEdge", edge: skenionEdge } satisfies GraphPatch;
          nextGraph = applyPatch(nextGraph, patch);
          patches.push(patch);
        }
      }
      onGraphChange(nextGraph, patches);
      onConnectionCheck(null);
    },
    [graph, onConnectionCheck, onGraphChange]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      let nextGraph = graph;
      const patches: GraphPatch[] = [];
      deletingNodeIdsRef.current = new Set(deletedNodes.map((node) => node.id));
      window.queueMicrotask(() => {
        deletingNodeIdsRef.current = new Set();
      });
      for (const node of deletedNodes) {
        const patch = { type: "removeNode", nodeId: node.id } satisfies GraphPatch;
        nextGraph = applyPatch(nextGraph, patch);
        patches.push(patch);
      }
      onGraphChange(nextGraph, patches);
      onSelectedNodeChange(null);
    },
    [graph, onGraphChange, onSelectedNodeChange]
  );

  const selectedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId]
  );

  return (
    <ReactFlow
      className="skenion-flow"
      deleteKeyCode={["Backspace", "Delete"]}
      edges={edges}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      nodeTypes={nodeTypes}
      nodes={selectedNodes}
      onConnect={onConnect}
      onEdgesChange={onEdgesChange}
      onEdgesDelete={onEdgesDelete}
      onNodeClick={(_event, node) => onSelectedNodeChange(node.id)}
      onNodeDragStop={onNodeDragStop}
      onNodesChange={onNodesChange}
      onNodesDelete={onNodesDelete}
      onPaneClick={() => onSelectedNodeChange(null)}
    >
      <Background color="#d8dee6" gap={20} size={1} />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}
