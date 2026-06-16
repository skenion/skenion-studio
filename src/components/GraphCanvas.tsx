import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart
} from "@xyflow/react";
import type { GraphDocumentV01 } from "@skenion/contracts";
import { ReactFlowNodeAdapter } from "./graph/ReactFlowNodeAdapter";
import {
  applyPatch,
  checkConnection,
  edgeFromReactFlow,
  isValidSkenionConnection,
  toSkenionPatch,
  type GraphPatch,
  type ConnectionCheck,
  type ViewPositions
} from "../graph/skenionGraph";
import {
  toReactFlowViewModel
} from "../graph/reactFlowAdapter";
import { portSemanticsForPort } from "../graph/portSemantics";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

interface GraphCanvasProps {
  graph: GraphDocumentV01;
  positions: ViewPositions;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  onConnectionCheck: (check: ConnectionCheck | null) => void;
  onSelectedEdgeChange: (edgeId: string | null) => void;
  onGraphChange: (graph: GraphDocumentV01, patches?: GraphPatch[]) => void;
  onPositionsChange: (positions: ViewPositions) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
}

export function GraphCanvas({
  graph,
  positions,
  selectedEdgeId,
  selectedNodeId,
  onConnectionCheck,
  onSelectedEdgeChange,
  onGraphChange,
  onPositionsChange,
  onSelectedNodeChange
}: GraphCanvasProps) {
  const viewModel = useMemo(() => toReactFlowViewModel(graph, positions), [graph, positions]);
  const [nodes, setNodes, onNodesChange] = useNodesState(viewModel.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(viewModel.edges);
  const deletingNodeIdsRef = useRef<Set<string>>(new Set());
  const activeConnectionRef = useRef<string | null>(null);
  const [activeConnectionMessage, setActiveConnectionMessage] = useState<string | null>(null);
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep",
      interactionWidth: 18
    }),
    []
  );

  useEffect(() => {
    setNodes(viewModel.nodes);
    setEdges(viewModel.edges);
  }, [setEdges, setNodes, viewModel.edges, viewModel.nodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      activeConnectionRef.current = null;
      setActiveConnectionMessage(null);
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

  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      isValidSkenionConnection(graph, {
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? null,
        target: connection.target,
        targetHandle: connection.targetHandle ?? null
      }),
    [graph]
  );

  const onConnectStart = useCallback<OnConnectStart>(
    (_event, params) => {
      const message = connectionStartMessage(graph, params.nodeId, params.handleId);
      activeConnectionRef.current = message;
      setActiveConnectionMessage(message);
      if (message) {
        onConnectionCheck({
          ok: true,
          message
        });
      }
    },
    [graph, onConnectionCheck]
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (_event, connectionState) => {
      window.setTimeout(() => {
        if (!activeConnectionRef.current) {
          return;
        }
        const attemptedConnection = connectionFromFinalState(connectionState);
        if (attemptedConnection) {
          onConnectionCheck(checkConnection(graph, toSkenionPatch(attemptedConnection)));
          activeConnectionRef.current = null;
          setActiveConnectionMessage(null);
          return;
        }
        onConnectionCheck({
          ok: false,
          message: `Connection rejected before drop. ${activeConnectionRef.current}`
        });
        activeConnectionRef.current = null;
        setActiveConnectionMessage(null);
      }, 0);
    },
    [graph, onConnectionCheck]
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
      if (deletedEdges.some((edge) => edge.id === selectedEdgeId)) {
        onSelectedEdgeChange(null);
      }
      onConnectionCheck(null);
    },
    [graph, onConnectionCheck, onGraphChange, onSelectedEdgeChange, selectedEdgeId]
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
      onSelectedEdgeChange(null);
      onSelectedNodeChange(null);
    },
    [graph, onGraphChange, onSelectedEdgeChange, onSelectedNodeChange]
  );

  const selectedNodes = useMemo(
    () => nodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId]
  );
  const selectedEdges = useMemo(
    () => edges.map((edge) => ({ ...edge, selected: edge.id === selectedEdgeId })),
    [edges, selectedEdgeId]
  );

  return (
    <ReactFlow
      className="skenion-flow"
      defaultEdgeOptions={defaultEdgeOptions}
      deleteKeyCode={["Backspace", "Delete"]}
      edges={selectedEdges}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      nodeTypes={nodeTypes}
      nodes={selectedNodes}
      isValidConnection={isValidConnection}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      onConnectStart={onConnectStart}
      onEdgesChange={onEdgesChange}
      onEdgesDelete={onEdgesDelete}
      onEdgeClick={(_event, edge) => {
        onSelectedEdgeChange(edge.id);
        onSelectedNodeChange(null);
      }}
      onNodeClick={(_event, node) => {
        onSelectedNodeChange(node.id);
        onSelectedEdgeChange(null);
      }}
      onNodeDragStop={onNodeDragStop}
      onNodesChange={onNodesChange}
      onNodesDelete={onNodesDelete}
      onPaneClick={() => {
        onSelectedNodeChange(null);
        onSelectedEdgeChange(null);
      }}
    >
      <Background color="#d8dee6" gap={20} size={1} />
      {activeConnectionMessage ? (
        <Panel className="connection-status" position="top-center">
          {activeConnectionMessage}
        </Panel>
      ) : null}
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}

function connectionFromFinalState(connectionState: FinalConnectionState): Connection | null {
  if (!connectionState.fromHandle || !connectionState.toHandle) {
    return null;
  }

  const { fromHandle, toHandle } = connectionState;
  if (fromHandle.type === "source" && toHandle.type === "target") {
    return {
      source: fromHandle.nodeId,
      sourceHandle: fromHandle.id ?? null,
      target: toHandle.nodeId,
      targetHandle: toHandle.id ?? null
    };
  }

  if (fromHandle.type === "target" && toHandle.type === "source") {
    return {
      source: toHandle.nodeId,
      sourceHandle: toHandle.id ?? null,
      target: fromHandle.nodeId,
      targetHandle: fromHandle.id ?? null
    };
  }

  return null;
}

function connectionStartMessage(
  graph: GraphDocumentV01,
  nodeId: string | null,
  portId: string | null
): string | null {
  if (!nodeId || !portId) {
    return null;
  }

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  const port = node?.ports.find((candidate) => candidate.id === portId);
  if (!node || !port) {
    return null;
  }

  const semantics = portSemanticsForPort(node, port);
  const side = port.direction === "output" ? "OUT" : "IN";
  return `Dragging ${side}: ${node.id}.${port.id} ${semantics.type}`;
}
