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
import type { ViewStateV01 } from "@skenion/contracts";
import { ReactFlowNodeAdapter } from "./graph/ReactFlowNodeAdapter";
import type { RuntimeControlMessage, RuntimeControlValue } from "../runtime/types";
import type { DisplayGraphDocumentV01, DisplayGraphNodeV01 } from "../graph/patchLibrary";
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
  toReactFlowViewModel,
  type SkenionNodeData
} from "../graph/reactFlowAdapter";
import { portSemanticsForPort } from "../graph/portSemantics";
import { runtimeControlValueEquals } from "../runtime/controlMessage";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

type StudioFlowNode = Node<SkenionNodeData>;

interface GraphCanvasProps {
  graph: DisplayGraphDocumentV01;
  graphLocked?: boolean;
  viewState: ViewStateV01;
  selectedEdgeId: string | null;
  selectedEdgeIds?: string[];
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  onConnectionCheck: (check: ConnectionCheck | null) => void;
  onAddNodeAtPosition?: (
    definitionId: string,
    position: { x: number; y: number },
    paramsOverride?: Record<string, unknown>
  ) => void;
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void> | void;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onObjectTextCommit?: (nodeId: string, text: string) => void;
  runtimeControlEnabled?: boolean;
  runtimeControlPulses?: Record<string, number>;
  runtimeControlValues?: Record<string, RuntimeControlValue>;
  onShowNodeHelp?: (definitionId: string) => void;
  onSelectedEdgeChange: (edgeId: string | null) => void;
  onSelectedEdgesChange?: (edgeIds: string[]) => void;
  onGraphChange: (graph: DisplayGraphDocumentV01, patches?: GraphPatch[]) => void;
  onViewStateChange: (viewState: ViewStateV01) => void;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onSelectedNodesChange?: (nodeIds: string[]) => void;
}

export function GraphCanvas({
  graph,
  graphLocked = true,
  viewState,
  selectedEdgeId,
  selectedEdgeIds = selectedEdgeId ? [selectedEdgeId] : [],
  selectedNodeId,
  selectedNodeIds = selectedNodeId ? [selectedNodeId] : [],
  onConnectionCheck,
  onAddNodeAtPosition,
  onImportAsset,
  onObjectControl,
  onObjectLiveControl,
  onObjectParamChange,
  onObjectTextCommit,
  runtimeControlEnabled = false,
  runtimeControlPulses = {},
  runtimeControlValues = {},
  onShowNodeHelp,
  onSelectedEdgeChange,
  onSelectedEdgesChange,
  onGraphChange,
  onViewStateChange,
  onSelectedNodeChange,
  onSelectedNodesChange
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
  const viewModel = useMemo(
    () => toReactFlowViewModel(graph, graphLayoutViewState),
    [graph, graphLayoutViewState]
  );
  const objectControlRef = useRef(onObjectControl);
  const objectLiveControlRef = useRef(onObjectLiveControl);
  const objectParamChangeRef = useRef(onObjectParamChange);
  const objectTextCommitRef = useRef(onObjectTextCommit);
  useEffect(() => {
    objectControlRef.current = onObjectControl;
  }, [onObjectControl]);
  useEffect(() => {
    objectLiveControlRef.current = onObjectLiveControl;
  }, [onObjectLiveControl]);
  useEffect(() => {
    objectParamChangeRef.current = onObjectParamChange;
  }, [onObjectParamChange]);
  useEffect(() => {
    objectTextCommitRef.current = onObjectTextCommit;
  }, [onObjectTextCommit]);
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
  const handleObjectTextCommit = useCallback((nodeId: string, text: string) => {
    objectTextCommitRef.current?.(nodeId, text);
  }, []);
  const flowNodes = useMemo<StudioFlowNode[]>(
    () =>
      viewModel.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onImportAsset,
          onObjectControl: handleObjectControl,
          onObjectLiveControl: handleObjectLiveControl,
          onObjectParamChange: handleObjectParamChange,
          onObjectTextCommit: handleObjectTextCommit,
          layoutEditable: !graphLocked,
          runtimeControlEnabled,
          runtimeControlPulseKey: runtimeControlPulses[node.id] ?? 0,
          runtimeControlValue: runtimeControlValues[node.id],
        }
      })),
    [
      handleObjectControl,
      handleObjectLiveControl,
      handleObjectParamChange,
      handleObjectTextCommit,
      graphLocked,
      onImportAsset,
      runtimeControlEnabled,
      runtimeControlPulses,
      runtimeControlValues,
      viewModel.nodes
    ]
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
    setNodes((currentNodes) => reconcileFlowNodes(currentNodes, flowNodes));
    setEdges((currentEdges) => reconcileFlowEdges(currentEdges, viewModel.edges));
  }, [flowNodes, setEdges, setNodes, viewModel.edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      activeConnectionRef.current = null;
      setActiveConnectionMessage(null);
      if (graphLocked) {
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before creating cables."
        });
        return;
      }
      const patch = toSkenionPatch(connection);
      const check = checkConnection(graph, patch);
      onConnectionCheck(check);
      if (!check.ok || !patch) {
        return;
      }

      onGraphChange(applyPatch(graph, patch), [patch]);
    },
    [graph, graphLocked, onConnectionCheck, onGraphChange]
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      !graphLocked &&
      isValidSkenionConnection(graph, {
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? null,
        target: connection.target,
        targetHandle: connection.targetHandle ?? null
      }),
    [graph, graphLocked]
  );

  const onConnectStart = useCallback<OnConnectStart>(
    (_event, params) => {
      if (graphLocked) {
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before creating cables."
        });
        return;
      }
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
    [graph, graphLocked, onConnectionCheck]
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (_event, connectionState) => {
      if (graphLocked) {
        activeConnectionRef.current = null;
        setActiveConnectionMessage(null);
        return;
      }
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
    [graph, graphLocked, onConnectionCheck]
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (graphLocked) {
        return;
      }
      onViewStateChange(updateViewStateNodePosition(graph, viewState, node.id, node.position));
    },
    [graph, graphLocked, onViewStateChange, viewState]
  );

  const onMoveEnd = useCallback(
    (nextViewport: Viewport) => {
      onViewStateChange(updateViewStateViewport(graph, viewState, nextViewport));
    },
    [graph, onViewStateChange, viewState]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (graphLocked) {
        return;
      }
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
    [graph, graphLocked, onConnectionCheck, onGraphChange, onSelectedEdgeChange, selectedEdgeId]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (graphLocked) {
        return;
      }
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
    [graph, graphLocked, onGraphChange, onSelectedEdgeChange, onSelectedNodeChange]
  );

  const addNodeAtMenuPosition = useCallback(
    (definitionId: string, paramsOverride: Record<string, unknown> = {}) => {
      if (!contextMenu || contextMenu.type !== "pane") {
        return;
      }
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before adding objects."
        });
        return;
      }
      onAddNodeAtPosition?.(definitionId, contextMenu.flowPosition, paramsOverride);
      setContextMenu(null);
    },
    [contextMenu, graphLocked, onAddNodeAtPosition, onConnectionCheck]
  );

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before deleting objects."
        });
        return;
      }
      const patch = { type: "removeNode", nodeId } satisfies GraphPatch;
      onGraphChange(applyPatch(graph, patch), [patch]);
      onSelectedNodeChange(null);
      onSelectedEdgeChange(null);
      setContextMenu(null);
    },
    [graph, graphLocked, onConnectionCheck, onGraphChange, onSelectedEdgeChange, onSelectedNodeChange]
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before deleting cables."
        });
        return;
      }
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
    [edges, graph, graphLocked, onConnectionCheck, onGraphChange, onSelectedEdgeChange]
  );

  const duplicateNodeById = useCallback(
    (nodeId: string) => {
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before duplicating objects."
        });
        return;
      }
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
    [graph, graphLocked, onConnectionCheck, onGraphChange, onSelectedEdgeChange, onSelectedNodeChange, onViewStateChange, viewState]
  );

  const selectedNodes = useMemo(
    () => applyNodeSelection(nodes, selectedNodeIds),
    [nodes, selectedNodeIds]
  );
  const selectedEdges = useMemo(
    () => applyEdgeSelection(edges, selectedEdgeIds),
    [edges, selectedEdgeIds]
  );

  return (
    <ReactFlow
      className="skenion-flow"
      defaultEdgeOptions={defaultEdgeOptions}
      defaultViewport={viewport}
      deleteKeyCode={graphLocked ? null : ["Backspace", "Delete"]}
      edges={selectedEdges}
      key={graph.id}
      nodeTypes={nodeTypes}
      nodes={selectedNodes}
      nodesConnectable={!graphLocked}
      nodesDraggable={!graphLocked}
      isValidConnection={isValidConnection}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      onConnectStart={onConnectStart}
      onEdgesChange={onEdgesChange}
      onEdgesDelete={onEdgesDelete}
      onEdgeClick={(_event, edge) => {
        onSelectedEdgeChange(edge.id);
        onSelectedEdgesChange?.([edge.id]);
        onSelectedNodeChange(null);
        onSelectedNodesChange?.([]);
      }}
      onEdgeContextMenu={(event, edge) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectedEdgeChange(edge.id);
        onSelectedEdgesChange?.([edge.id]);
        onSelectedNodeChange(null);
        onSelectedNodesChange?.([]);
        setContextMenu({
          type: "edge",
          edgeId: edge.id,
          screenX: event.clientX,
          screenY: event.clientY
        });
      }}
      onNodeClick={(_event, node) => {
        onSelectedNodeChange(node.id);
        onSelectedNodesChange?.([node.id]);
        onSelectedEdgeChange(null);
        onSelectedEdgesChange?.([]);
      }}
      onNodeContextMenu={(event, node) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectedNodeChange(node.id);
        onSelectedNodesChange?.([node.id]);
        onSelectedEdgeChange(null);
        onSelectedEdgesChange?.([]);
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
        onSelectedNodesChange?.([]);
        onSelectedEdgeChange(null);
        onSelectedEdgesChange?.([]);
        setContextMenu(null);
      }}
      onPaneContextMenu={(event) => {
        event.preventDefault();
        if (graphLocked) {
          setContextMenu({
            type: "pane",
            flowPosition: { x: 0, y: 0 },
            screenX: event.clientX,
            screenY: event.clientY
          });
          return;
        }
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
      onSelectionChange={({ nodes: nextSelectedNodes, edges: nextSelectedEdges }) => {
        const nextNodeIds = nextSelectedNodes.map((node) => node.id);
        const nextEdgeIds = nextSelectedEdges.map((edge) => edge.id);
        onSelectedNodesChange?.(nextNodeIds);
        onSelectedEdgesChange?.(nextEdgeIds);
        onSelectedNodeChange(nextNodeIds[0] ?? null);
        onSelectedEdgeChange(nextNodeIds.length > 0 ? null : nextEdgeIds[0] ?? null);
      }}
      onMoveEnd={(_event, nextViewport) => onMoveEnd(nextViewport)}
    >
      <Background color="var(--sk-grid-dot)" gap={20} size={1} />
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
        layoutEditable={!graphLocked}
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
  layoutEditable,
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
  layoutEditable: boolean;
  menu: CanvasContextMenuState | null;
  onAddNode: (definitionId: string, paramsOverride?: Record<string, unknown>) => void;
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
          {layoutEditable ? <button onClick={() => onDuplicateNode(menu.nodeId)} type="button">Duplicate</button> : null}
          <button onClick={() => onCopy(menu.nodeId)} type="button">Copy Node ID</button>
          <button onClick={() => onCopy(`node:${menu.nodeId}`)} type="button">Copy Node Address</button>
          {layoutEditable ? <button className="is-danger" onClick={() => onDeleteNode(menu.nodeId)} type="button">Delete</button> : null}
        </>
      ) : null}
      {menu.type === "edge" ? (
        <>
          <button onClick={() => onInspectEdge(menu.edgeId)} type="button">Inspect Cable</button>
          <button onClick={() => onCopy(menu.edgeId)} type="button">Copy Edge ID</button>
          {layoutEditable ? <button className="is-danger" onClick={() => onDeleteEdge(menu.edgeId)} type="button">Delete Cable</button> : null}
        </>
      ) : null}
      {menu.type === "pane" ? (
        <>
          {layoutEditable ? (
            <>
              <button onClick={() => onAddNode("core.comment")} type="button">Add Comment</button>
              <button onClick={() => onAddNode("core.panel")} type="button">Add Panel</button>
              <button onClick={() => onAddNode("core.message")} type="button">Add Message</button>
              <button onClick={() => onAddNode("core.bang")} type="button">Add Bang</button>
              <button onClick={() => onAddNode("core.bool", { label: "Enabled", widget: "toggle" })} type="button">Add Toggle</button>
              <button
                onClick={() => onAddNode("core.float", { label: "Value", max: 1, min: 0, step: 0.01, widget: "slider" })}
                type="button"
              >
                Add Slider
              </button>
              <button onClick={() => onAddNode("core.float")} type="button">Add Float</button>
              <button onClick={() => onAddNode("core.video-asset")} type="button">Add Video Asset</button>
            </>
          ) : null}
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

function reconcileFlowNodes(
  currentNodes: StudioFlowNode[],
  nextNodes: StudioFlowNode[]
): StudioFlowNode[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  let changed = currentNodes.length !== nextNodes.length;
  const reconciled = nextNodes.map((nextNode) => {
    const currentNode = currentById.get(nextNode.id);
    if (currentNode && sameFlowNode(currentNode, nextNode)) {
      return currentNode;
    }
    changed = true;
    return currentNode ? mergeFlowNode(currentNode, nextNode) : nextNode;
  });
  return changed ? reconciled : currentNodes;
}

function reconcileFlowEdges(currentEdges: Edge[], nextEdges: Edge[]): Edge[] {
  const currentById = new Map(currentEdges.map((edge) => [edge.id, edge]));
  let changed = currentEdges.length !== nextEdges.length;
  const reconciled = nextEdges.map((nextEdge) => {
    const currentEdge = currentById.get(nextEdge.id);
    if (currentEdge && sameFlowEdge(currentEdge, nextEdge)) {
      return currentEdge;
    }
    changed = true;
    return nextEdge;
  });
  return changed ? reconciled : currentEdges;
}

function applyNodeSelection(nodes: StudioFlowNode[], selectedNodeIds: string[]): StudioFlowNode[] {
  const selectedNodeIdSet = new Set(selectedNodeIds);
  let changed = false;
  const selectedNodes = nodes.map((node) => {
    const selected = selectedNodeIdSet.has(node.id);
    if (Boolean(node.selected) === selected) {
      return node;
    }
    changed = true;
    return { ...node, selected };
  });
  return changed ? selectedNodes : nodes;
}

function mergeFlowNode(currentNode: StudioFlowNode, nextNode: StudioFlowNode): StudioFlowNode {
  return {
    ...currentNode,
    ...nextNode,
    position: currentNode.dragging ? currentNode.position : nextNode.position,
    data: {
      ...currentNode.data,
      ...nextNode.data
    }
  };
}

function applyEdgeSelection(edges: Edge[], selectedEdgeIds: string[]): Edge[] {
  const selectedEdgeIdSet = new Set(selectedEdgeIds);
  let changed = false;
  const selectedEdges = edges.map((edge) => {
    const selected = selectedEdgeIdSet.has(edge.id);
    if (Boolean(edge.selected) === selected) {
      return edge;
    }
    changed = true;
    return { ...edge, selected };
  });
  return changed ? selectedEdges : edges;
}

function sameFlowNode(currentNode: StudioFlowNode, nextNode: StudioFlowNode): boolean {
  return (
    currentNode.type === nextNode.type &&
    currentNode.dragHandle === nextNode.dragHandle &&
    currentNode.position.x === nextNode.position.x &&
    currentNode.position.y === nextNode.position.y &&
    currentNode.data.node === nextNode.data.node &&
    currentNode.data.layoutEditable === nextNode.data.layoutEditable &&
    currentNode.data.runtimeControlEnabled === nextNode.data.runtimeControlEnabled &&
    currentNode.data.runtimeControlPulseKey === nextNode.data.runtimeControlPulseKey &&
    runtimeControlValueEquals(
      currentNode.data.runtimeControlValue,
      nextNode.data.runtimeControlValue
    )
  );
}

function sameFlowEdge(currentEdge: Edge, nextEdge: Edge): boolean {
  return (
    currentEdge.source === nextEdge.source &&
    currentEdge.sourceHandle === nextEdge.sourceHandle &&
    currentEdge.target === nextEdge.target &&
    currentEdge.targetHandle === nextEdge.targetHandle &&
    currentEdge.type === nextEdge.type &&
    currentEdge.label === nextEdge.label &&
    JSON.stringify(currentEdge.style ?? {}) === JSON.stringify(nextEdge.style ?? {}) &&
    JSON.stringify(currentEdge.markerStart ?? null) === JSON.stringify(nextEdge.markerStart ?? null) &&
    JSON.stringify(currentEdge.markerEnd ?? null) === JSON.stringify(nextEdge.markerEnd ?? null)
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
  graph: DisplayGraphDocumentV01,
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
