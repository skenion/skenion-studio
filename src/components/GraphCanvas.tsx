import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  type Viewport
} from "@xyflow/react";
import type { GraphDocumentV01, ViewStateV01 } from "@skenion/contracts";
import { ReactFlowNodeAdapter } from "./graph/ReactFlowNodeAdapter";
import type { RuntimeControlMessage } from "../runtime/types";
import {
  applyPatch,
  checkConnection,
  edgeFromReactFlow,
  isValidSkenionConnection,
  toSkenionPatch,
  type GraphPatch,
  type ConnectionCheck
} from "../graph/skenionGraph";
import { updateViewStateNodePosition, updateViewStateViewport } from "../graph/projectDocument";
import {
  toReactFlowViewModel
} from "../graph/reactFlowAdapter";
import { portSemanticsForPort } from "../graph/portSemantics";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

interface GraphCanvasProps {
  graph: GraphDocumentV01;
  viewState: ViewStateV01;
  selectedEdgeId: string | null;
  selectedNodeId: string | null;
  onConnectionCheck: (check: ConnectionCheck | null) => void;
  onAddNodeAtPosition?: (definitionId: string, position: { x: number; y: number }) => void;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onShowNodeHelp?: (definitionId: string) => void;
  onSelectedEdgeChange: (edgeId: string | null) => void;
  onGraphChange: (graph: GraphDocumentV01, patches?: GraphPatch[]) => void;
  onViewStateChange: (viewState: ViewStateV01) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
}

export function GraphCanvas({
  graph,
  viewState,
  selectedEdgeId,
  selectedNodeId,
  onConnectionCheck,
  onAddNodeAtPosition,
  onObjectControl,
  onObjectLiveControl,
  onObjectParamChange,
  onShowNodeHelp,
  onSelectedEdgeChange,
  onGraphChange,
  onViewStateChange,
  onSelectedNodeChange
}: GraphCanvasProps) {
  const nodeViewStateKey = JSON.stringify(viewState.canvas.nodes);
  const graphLayoutViewState = useMemo(
    () =>
      ({
        schema: "skenion.view-state",
        schemaVersion: "0.1.0",
        canvas: {
          nodes: JSON.parse(nodeViewStateKey) as ViewStateV01["canvas"]["nodes"],
          viewport: { x: 0, y: 0, zoom: 1 }
        }
      }) satisfies ViewStateV01,
    [nodeViewStateKey]
  );
  const viewModel = useMemo(() => toReactFlowViewModel(graph, graphLayoutViewState), [graph, graphLayoutViewState]);
  const objectControlRef = useRef(onObjectControl);
  const objectLiveControlRef = useRef(onObjectLiveControl);
  const objectParamChangeRef = useRef(onObjectParamChange);
  useEffect(() => {
    objectControlRef.current = onObjectControl;
  }, [onObjectControl]);
  useEffect(() => {
    objectLiveControlRef.current = onObjectLiveControl;
  }, [onObjectLiveControl]);
  useEffect(() => {
    objectParamChangeRef.current = onObjectParamChange;
  }, [onObjectParamChange]);
  const handleObjectControl = useCallback(
    (nodeId: string, portId: string, message: RuntimeControlMessage) => {
      objectControlRef.current?.(nodeId, portId, message);
    },
    []
  );
  const handleObjectParamChange = useCallback(
    (nodeId: string, key: string, value: unknown) => {
      objectParamChangeRef.current?.(nodeId, key, value);
    },
    []
  );
  const handleObjectLiveControl = useCallback(
    (nodeId: string, portId: string, message: RuntimeControlMessage) => {
      objectLiveControlRef.current?.(nodeId, portId, message);
    },
    []
  );
  const flowNodes = useMemo(
    () =>
      viewModel.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onObjectControl: handleObjectControl,
          onObjectLiveControl: handleObjectLiveControl,
          onObjectParamChange: handleObjectParamChange
        }
      })),
    [handleObjectControl, handleObjectLiveControl, handleObjectParamChange, viewModel.nodes]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(viewModel.edges);
  const deletingNodeIdsRef = useRef<Set<string>>(new Set());
  const activeConnectionRef = useRef<string | null>(null);
  const [activeConnectionMessage, setActiveConnectionMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(null);
  const viewport = viewState.canvas.viewport ?? { x: 0, y: 0, zoom: 1 };
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep",
      interactionWidth: 18
    }),
    []
  );

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(viewModel.edges);
  }, [flowNodes, setEdges, setNodes, viewModel.edges]);

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
      onViewStateChange(updateViewStateNodePosition(graph, viewState, node.id, node.position));
    },
    [graph, onViewStateChange, viewState]
  );

  const onMoveEnd = useCallback(
    (nextViewport: Viewport) => {
      onViewStateChange(updateViewStateViewport(graph, viewState, nextViewport));
    },
    [graph, onViewStateChange, viewState]
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

  const addNodeAtMenuPosition = useCallback(
    (definitionId: string) => {
      if (!contextMenu || contextMenu.type !== "pane") {
        return;
      }
      onAddNodeAtPosition?.(definitionId, contextMenu.flowPosition);
      setContextMenu(null);
    },
    [contextMenu, onAddNodeAtPosition]
  );

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      const patch = { type: "removeNode", nodeId } satisfies GraphPatch;
      onGraphChange(applyPatch(graph, patch), [patch]);
      onSelectedNodeChange(null);
      onSelectedEdgeChange(null);
      setContextMenu(null);
    },
    [graph, onGraphChange, onSelectedEdgeChange, onSelectedNodeChange]
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      const edge = edges.find((candidate) => candidate.id === edgeId);
      const skenionEdge = edge ? edgeFromReactFlow(edge) : null;
      if (!skenionEdge) {
        return;
      }
      const patch = { type: "removeEdge", edge: skenionEdge } satisfies GraphPatch;
      onGraphChange(applyPatch(graph, patch), [patch]);
      onSelectedEdgeChange(null);
      setContextMenu(null);
    },
    [edges, graph, onGraphChange, onSelectedEdgeChange]
  );

  const duplicateNodeById = useCallback(
    (nodeId: string) => {
      const source = graph.nodes.find((node) => node.id === nodeId);
      const viewNode = viewState.canvas.nodes[nodeId];
      if (!source) {
        return;
      }
      const nextId = nextDuplicateNodeId(source.id, graph.nodes.map((node) => node.id));
      const node = {
        ...JSON.parse(JSON.stringify(source)),
        id: nextId
      } as typeof source;
      const patch = { type: "addNode", node } satisfies GraphPatch;
      const nextGraph = applyPatch(graph, patch);
      onGraphChange(nextGraph, [patch]);
      onViewStateChange(
        reconcileViewStateAfterDuplicate(viewState, nextId, viewNode ?? { x: 120, y: 120 })
      );
      onSelectedNodeChange(nextId);
      onSelectedEdgeChange(null);
      setContextMenu(null);
    },
    [graph, onGraphChange, onSelectedEdgeChange, onSelectedNodeChange, onViewStateChange, viewState]
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
      defaultViewport={viewport}
      deleteKeyCode={["Backspace", "Delete"]}
      edges={selectedEdges}
      key={graph.id}
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
      onEdgeContextMenu={(event, edge) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectedEdgeChange(edge.id);
        onSelectedNodeChange(null);
        setContextMenu({
          type: "edge",
          edgeId: edge.id,
          screenX: event.clientX,
          screenY: event.clientY
        });
      }}
      onNodeClick={(_event, node) => {
        onSelectedNodeChange(node.id);
        onSelectedEdgeChange(null);
      }}
      onNodeContextMenu={(event, node) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectedNodeChange(node.id);
        onSelectedEdgeChange(null);
        setContextMenu({
          type: "node",
          nodeId: node.id,
          nodeKind: String(node.data.kind),
          screenX: event.clientX,
          screenY: event.clientY
        });
      }}
      onNodeDragStop={onNodeDragStop}
      onNodesChange={onNodesChange}
      onNodesDelete={onNodesDelete}
      onPaneClick={() => {
        onSelectedNodeChange(null);
        onSelectedEdgeChange(null);
        setContextMenu(null);
      }}
      onPaneContextMenu={(event) => {
        event.preventDefault();
        const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
        setContextMenu({
          type: "pane",
          flowPosition: {
            x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
            y: (event.clientY - bounds.top - viewport.y) / viewport.zoom
          },
          screenX: event.clientX,
          screenY: event.clientY
        });
      }}
      onMoveEnd={(_event, nextViewport) => onMoveEnd(nextViewport)}
    >
      <Background color="#d8dee6" gap={20} size={1} />
      {activeConnectionMessage ? (
        <Panel className="connection-status" position="top-center">
          {activeConnectionMessage}
        </Panel>
      ) : null}
      <ReactFlowContextMenu
        menu={contextMenu}
        onAddNode={addNodeAtMenuPosition}
        onClose={() => setContextMenu(null)}
        onCopy={(text) => {
          void navigator.clipboard?.writeText(text);
          setContextMenu(null);
        }}
        onDeleteEdge={deleteEdgeById}
        onDeleteNode={deleteNodeById}
        onDuplicateNode={duplicateNodeById}
        onInspectEdge={(edgeId) => {
          onSelectedEdgeChange(edgeId);
          onSelectedNodeChange(null);
          setContextMenu(null);
        }}
        onInspectNode={(nodeId) => {
          onSelectedNodeChange(nodeId);
          onSelectedEdgeChange(null);
          setContextMenu(null);
        }}
        onShowHelp={(definitionId) => {
          onShowNodeHelp?.(definitionId);
          setContextMenu(null);
        }}
      />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}

type CanvasContextMenuState =
  | {
      type: "node";
      nodeId: string;
      nodeKind: string;
      screenX: number;
      screenY: number;
    }
  | {
      type: "edge";
      edgeId: string;
      screenX: number;
      screenY: number;
    }
  | {
      type: "pane";
      flowPosition: { x: number; y: number };
      screenX: number;
      screenY: number;
    };

function ReactFlowContextMenu({
  menu,
  onAddNode,
  onClose,
  onCopy,
  onDeleteEdge,
  onDeleteNode,
  onDuplicateNode,
  onInspectEdge,
  onInspectNode,
  onShowHelp
}: {
  menu: CanvasContextMenuState | null;
  onAddNode: (definitionId: string) => void;
  onClose: () => void;
  onCopy: (text: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onInspectEdge: (edgeId: string) => void;
  onInspectNode: (nodeId: string) => void;
  onShowHelp: (definitionId: string) => void;
}) {
  const { fitView } = useReactFlow();
  if (!menu) {
    return null;
  }

  return (
    <div
      className="canvas-context-menu"
      onClick={(event) => event.stopPropagation()}
      style={{ left: menu.screenX, top: menu.screenY }}
    >
      {menu.type === "node" ? (
        <>
          <button onClick={() => onInspectNode(menu.nodeId)} type="button">Inspect</button>
          <button onClick={() => onShowHelp(menu.nodeKind)} type="button">Help</button>
          <button onClick={() => onDuplicateNode(menu.nodeId)} type="button">Duplicate</button>
          <button onClick={() => onCopy(menu.nodeId)} type="button">Copy Node ID</button>
          <button onClick={() => onCopy(`node:${menu.nodeId}`)} type="button">Copy Node Address</button>
          <button className="is-danger" onClick={() => onDeleteNode(menu.nodeId)} type="button">Delete</button>
        </>
      ) : null}
      {menu.type === "edge" ? (
        <>
          <button onClick={() => onInspectEdge(menu.edgeId)} type="button">Inspect Cable</button>
          <button onClick={() => onCopy(menu.edgeId)} type="button">Copy Edge ID</button>
          <button className="is-danger" onClick={() => onDeleteEdge(menu.edgeId)} type="button">Delete Cable</button>
        </>
      ) : null}
      {menu.type === "pane" ? (
        <>
          <button onClick={() => onAddNode("core.comment")} type="button">Add Comment</button>
          <button onClick={() => onAddNode("core.panel")} type="button">Add Panel</button>
          <button onClick={() => onAddNode("core.message")} type="button">Add Message</button>
          <button onClick={() => onAddNode("ui.button")} type="button">Add Bang</button>
          <button onClick={() => onAddNode("ui.toggle")} type="button">Add Toggle</button>
          <button onClick={() => onAddNode("ui.slider-float")} type="button">Add Slider</button>
          <button onClick={() => onAddNode("core.float")} type="button">Add Float</button>
          <button onClick={() => onAddNode("core.video-asset")} type="button">Add Video Asset</button>
          <button onClick={() => { fitView({ padding: 0.2 }); onClose(); }} type="button">Fit View</button>
        </>
      ) : null}
    </div>
  );
}

function nextDuplicateNodeId(baseId: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let index = 2;
  let id = `${baseId}_${index}`;
  while (used.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }
  return id;
}

function reconcileViewStateAfterDuplicate(
  viewState: ViewStateV01,
  nodeId: string,
  sourcePosition: { x: number; y: number }
): ViewStateV01 {
  return {
    ...viewState,
    canvas: {
      ...viewState.canvas,
      nodes: {
        ...viewState.canvas.nodes,
        [nodeId]: {
          x: sourcePosition.x + 32,
          y: sourcePosition.y + 32
        }
      }
    }
  };
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
