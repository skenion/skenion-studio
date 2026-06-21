import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppShell, Badge, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { CircleAlert, X } from "lucide-react";
import {
  getBuiltinNodeHelpGraph,
  validateRuntimeOperationEnvelope,
  type GraphDocumentV01,
  type GraphFragmentV02,
  type GraphNodeV01,
  type GraphPatchOperationV01,
  type RuntimeOperationEnvelope,
  type ViewStateV01
} from "@skenion/contracts";
import { GraphCanvas } from "./components/GraphCanvas";
import { DiagnosticsFooter } from "./components/DiagnosticsFooter";
import { InspectorPanel } from "./components/InspectorPanel";
import { PalettePanel } from "./components/PalettePanel";
import { RuntimeLogsPanel, RuntimeSettingsPanel } from "./components/RuntimePanel";
import { StudioToolbar } from "./components/StudioToolbar";
import { Dialog } from "./components/core/Dialog/Dialog";
import { Button as CoreButton } from "./components/core/Button/Button";
import { IconButton } from "./components/core/IconButton/IconButton";
import { clientLogLine, runtimeLogLineFromEvent, type LogLevel, type LogLine } from "./components/log/LogConsole";
import { nodeRegistry } from "./data/registry";
import {
  portDemoSampleGraph,
  portDemoSampleViewState,
  renderSampleGraph,
  sampleGraph,
  objectRoutingPanelSampleGraph,
  objectRoutingPanelSampleViewState,
  shaderMultiUniformSampleGraph,
  shaderMultiUniformSampleViewState,
  shaderUniformSampleGraph,
  shaderUniformSampleViewState
} from "./data/sampleGraph";
import {
  applyPatch,
  createGraphNodeFromDefinition,
  graphSummary,
  normalizeLegacyGraphTypes,
  validateGraph,
  type ConnectionCheck,
  type GraphPatch
} from "./graph/skenionGraph";
import { createGraphNodeFromObjectText } from "./graph/objectTextNode";
import {
  createProjectDocument,
  createViewStateFromPositions,
  parseProjectDocument,
  reconcileViewStateWithGraph
} from "./graph/projectDocument";
import { videoAssetSizeForSource } from "./graph/videoAsset";
import {
  analyzeGraphPortSemantics,
  findEdgeInspectorModel
} from "./graph/portSemantics";
import {
  createGraphPatch,
  graphPatchFromStudioAction
} from "./graph/graphPatch";
import {
  createGraphFragmentFromSelection,
  graphClipboardShortcutAction,
  graphFragmentPasteAvailability,
  type GraphFragmentBuildResult,
  parseGraphFragmentClipboard,
  serializeGraphFragmentClipboard
} from "./graph/fragmentClipboard";
import { createReplaceShaderInterfacePatch } from "./graph/fullscreenShader";
import {
  createRuntimeClient,
  DEFAULT_RUNTIME_URL,
  isRuntimeSessionEvent,
  isRuntimeLogEvent,
  runtimeLogStreamUrl,
  runtimeSessionEventsStreamUrl,
  RuntimeClientError,
  type RuntimeClient
} from "./runtime/client";
import { createRuntimeProjectPayload } from "./runtime/payload";
import {
  runtimeGraphFingerprint,
  runtimeSessionFingerprint,
  runtimeSessionIsSynced
} from "./runtime/sessionSync";
import { runtimeControlValueEquals } from "./runtime/controlMessage";
import type {
  RuntimeActionResult,
  RuntimeConnectionStatus,
  RuntimeControlEventResponse,
  RuntimeControlEventRequest,
  RuntimeControlStateResponse,
  RuntimeControlValue,
  RuntimeGeneratedShaderResponse,
  RuntimeHistory,
  RuntimeInfo,
  RuntimePatchResponse,
  RuntimeResultKind,
  RuntimePreviewStatus,
  RuntimeSessionEvent,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot,
  RuntimeViewPatchOperation
} from "./runtime/types";
import { runtimeHistoryActionAvailability } from "./runtime/historySync";
import { runtimeHistoryShortcutAction, type RuntimeHistoryShortcutAction } from "./runtime/historyShortcuts";
import {
  createVolatileHelpWorkingCopy,
  type VolatileHelpWorkingCopy
} from "./components/help/HelpGraphViewer";

export default function App() {
  const [graph, setGraph] = useState<GraphDocumentV01>(sampleGraph);
  const [viewState, setViewState] = useState(() => createViewStateFromPositions(sampleGraph, {}));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("value_1");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(["value_1"]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [graphFragmentClipboard, setGraphFragmentClipboard] = useState<GraphFragmentV02 | null>(null);
  const [helpWorkingCopy, setHelpWorkingCopy] = useState<VolatileHelpWorkingCopy | null>(null);
  const [helpWorkingCopySelectedNodeIds, setHelpWorkingCopySelectedNodeIds] = useState<string[]>([]);
  const [helpWorkingCopySelectedEdgeIds, setHelpWorkingCopySelectedEdgeIds] = useState<string[]>([]);
  const [helpWorkingCopySelectedNodeId, setHelpWorkingCopySelectedNodeId] = useState<string | null>(null);
  const [helpWorkingCopySelectedEdgeId, setHelpWorkingCopySelectedEdgeId] = useState<string | null>(null);
  const [helpWorkingCopyConnectionCheck, setHelpWorkingCopyConnectionCheck] = useState<ConnectionCheck | null>(null);
  const [activeHelpNodeId, setActiveHelpNodeId] = useState<string | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [inspectorEdgeHovered, setInspectorEdgeHovered] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [clientLogLines, setClientLogLines] = useState<LogLine[]>([]);
  const [runtimeStreamLogLines, setRuntimeStreamLogLines] = useState<LogLine[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [graphLocked, setGraphLocked] = useState(true);
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheck | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [runtimeUrl, setRuntimeUrl] = useState(DEFAULT_RUNTIME_URL);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeConnectionStatus>("disconnected");
  const [runtimeBusyAction, setRuntimeBusyAction] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeFrames] = useState(2);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [runtimeResult, setRuntimeResult] = useState<RuntimeActionResult | null>(null);
  const [runtimeSession, setRuntimeSession] = useState<RuntimeSessionResponse | null>(null);
  const [runtimeControlState, setRuntimeControlState] = useState<RuntimeControlStateResponse | null>(null);
  const [runtimeControlPulses, setRuntimeControlPulses] = useState<Record<string, number>>({});
  const runtimeControlPulseCounterRef = useRef(0);
  const [runtimeHistory, setRuntimeHistory] = useState<RuntimeHistory | null>(null);
  const [runtimePreviewStatus, setRuntimePreviewStatus] = useState<RuntimePreviewStatus | null>(null);
  const [runtimeTelemetry, setRuntimeTelemetry] = useState<RuntimeTelemetrySnapshot | null>(null);
  const [generatedShader, setGeneratedShader] = useState<RuntimeGeneratedShaderResponse | null>(null);
  const [lastLoadedGraphFingerprint, setLastLoadedGraphFingerprint] = useState<string | null>(null);
  const [pendingPatchOps, setPendingPatchOps] = useState<GraphPatchOperationV01[]>([]);
  const [, setPendingPatchBaseRevision] = useState<string | null>(null);
  const [, setPatchConflict] = useState<string | null>(null);
  const validation = useMemo(() => validateGraph(graph), [graph]);
  const semanticDiagnostics = useMemo(() => analyzeGraphPortSemantics(graph), [graph]);
  const runtimeSessionSynced = runtimeSessionIsSynced(
    runtimeStatus,
    runtimeSession,
    runtimeGraphFingerprint(graph.id, graph.revision),
    lastLoadedGraphFingerprint
  );
  const runtimeControlInteractionEnabled =
    runtimeStatus === "connected" &&
    runtimeSessionSynced &&
    runtimeSessionLoaded(runtimeSession) &&
    runtimeSupportsControl(runtimeInfo) &&
    runtimeSupportsControlState(runtimeInfo);
  const runtimeGraphAvailable =
    runtimeStatus === "connected" &&
    runtimeSessionSynced &&
    runtimeSessionLoaded(runtimeSession);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => findEdgeInspectorModel(graph, selectedEdgeId),
    [graph, selectedEdgeId]
  );
  const selectedRuntimeShaderDiagnostics = useMemo(() => {
    if (selectedNode?.kind !== "render.fullscreen-shader") {
      return [];
    }
    return runtimeTelemetry?.render.diagnostics ?? [];
  }, [runtimeTelemetry, selectedNode?.id, selectedNode?.kind]);
  const liveControlQueueRef = useRef<{
    inFlight: boolean;
    latestSequence: number;
    nextSequence: number;
    request: { request: RuntimeControlEventRequest; sequence: number } | null;
  }>({ inFlight: false, latestSequence: 0, nextSequence: 0, request: null });
  const runtimeLiveStateRef = useRef({
    info: runtimeInfo,
    sessionLoaded: runtimeSessionLoaded(runtimeSession),
    sessionSynced: runtimeSessionSynced,
    status: runtimeStatus,
    url: runtimeUrl
  });

  useEffect(() => {
    runtimeLiveStateRef.current = {
      info: runtimeInfo,
      sessionLoaded: runtimeSessionLoaded(runtimeSession),
      sessionSynced: runtimeSessionSynced,
      status: runtimeStatus,
      url: runtimeUrl
    };
  }, [runtimeInfo, runtimeSession?.snapshot.project, runtimeSessionSynced, runtimeStatus, runtimeUrl]);

  useEffect(() => {
    const appendClientError = (message: string) => {
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(`browser-${timestamp}-${current.length}`, "error", message, timestamp)
        ].slice(-200)
      );
    };
    const handleError = (event: ErrorEvent) => {
      appendClientError(event.message || "Browser client error.");
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      appendClientError(reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection."));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (runtimeStatus !== "connected" || !runtimeSupportsLogStream(runtimeInfo)) {
      setRuntimeStreamLogLines([]);
      return undefined;
    }

    let reportedStreamError = false;
    const source = new EventSource(runtimeLogStreamUrl(runtimeUrl));
    const handleRuntimeLog = (event: MessageEvent) => {
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isRuntimeLogEvent(value)) {
        return;
      }
      const line = runtimeLogLineFromEvent(value);
      setRuntimeStreamLogLines((current) => upsertBoundedLogLine(current, line));
    };
    const handleLogGap = () => {
      const timestamp = new Date().toISOString();
      setRuntimeStreamLogLines((current) =>
        upsertBoundedLogLine(current, {
          id: `runtime:stream-gap-${timestamp}`,
          level: "warning",
          message: "runtime log stream receiver lagged; some events may be missing",
          source: "runtime",
          timestamp
        })
      );
    };
    const handleStreamError = () => {
      if (reportedStreamError) {
        return;
      }
      reportedStreamError = true;
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(
            `runtime-log-stream-${timestamp}-${current.length}`,
            "warning",
            "Runtime log stream disconnected.",
            timestamp
          )
        ].slice(-200)
      );
    };

    source.addEventListener("log", handleRuntimeLog);
    source.addEventListener("log-gap", handleLogGap);
    source.addEventListener("error", handleStreamError);

    return () => {
      source.removeEventListener("log", handleRuntimeLog);
      source.removeEventListener("log-gap", handleLogGap);
      source.removeEventListener("error", handleStreamError);
      source.close();
    };
  }, [runtimeInfo, runtimeStatus, runtimeUrl]);

  useEffect(() => {
    if (runtimeStatus !== "connected" || !runtimeSupportsSessionEvents(runtimeInfo)) {
      return undefined;
    }

    let reportedStreamError = false;
    const source = new EventSource(runtimeSessionEventsStreamUrl(runtimeUrl));
    const handleSessionEvent = (event: MessageEvent) => {
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isRuntimeSessionEvent(value)) {
        return;
      }

      const eventSession = runtimeSessionFromEvent(value);
      setRuntimeSession(eventSession);
      setRuntimeHistory(value.history);
      setRuntimeStatus("connected");
      const project = value.snapshot.project;
      if (project) {
        acceptRuntimeGraph(project.graph, project.viewState);
        setLastLoadedGraphFingerprint(runtimeSessionFingerprint(eventSession));
        if (runtimeSupportsControlState(runtimeInfo)) {
          void refreshRuntimeControlState(createRuntimeClient({ baseUrl: runtimeUrl }), runtimeInfo);
        }
        return;
      }
      setRuntimeControlState(null);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
    };
    const handleSessionGap = () => {
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(
            `runtime-session-gap-${timestamp}-${current.length}`,
            "warning",
            "Runtime session stream receiver lagged; refreshing session.",
            timestamp
          )
        ].slice(-200)
      );
      void refreshRuntimeProjectFromRuntime(createRuntimeClient({ baseUrl: runtimeUrl }));
    };
    const handleStreamError = () => {
      if (reportedStreamError) {
        return;
      }
      reportedStreamError = true;
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(
            `runtime-session-stream-${timestamp}-${current.length}`,
            "warning",
            "Runtime session stream disconnected.",
            timestamp
          )
        ].slice(-200)
      );
    };

    source.addEventListener("session", handleSessionEvent);
    source.addEventListener("session-gap", handleSessionGap);
    source.addEventListener("error", handleStreamError);

    return () => {
      source.removeEventListener("session", handleSessionEvent);
      source.removeEventListener("session-gap", handleSessionGap);
      source.removeEventListener("error", handleStreamError);
      source.close();
    };
  }, [runtimeInfo, runtimeStatus, runtimeUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = runtimeHistoryShortcutAction(event);
      if (!action) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const availability = runtimeHistoryActionAvailability({
        connected: runtimeStatus === "connected",
        graphLocked,
        sessionLoaded: runtimeSessionLoaded(runtimeSession),
        sessionSynced: runtimeSessionSynced,
        pendingPatchOps: pendingPatchOps.length,
        history: runtimeHistory
      });
      if (runtimeBusyAction || (action === "undo" ? !availability.canUndo : !availability.canRedo)) {
        return;
      }

      void runRuntimeHistoryShortcut(action);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    pendingPatchOps.length,
    graphLocked,
    runtimeBusyAction,
    runtimeHistory,
    runtimeInfo,
    runtimeSession?.snapshot.project,
    runtimeSessionSynced,
    runtimeStatus,
    runtimeUrl
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isHelpWorkingCopyTarget(event.target)) {
        const action = graphClipboardShortcutAction(event);
        if (action === "copy") {
          event.preventDefault();
          event.stopPropagation();
          void copyHelpWorkingCopySelection();
        }
        return;
      }
      if (isHelpGraphViewerTarget(event.target)) {
        return;
      }
      const action = graphClipboardShortcutAction(event);
      if (!action) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (action === "copy") {
        void copySelectedGraphFragment();
        return;
      }
      void pasteGraphFragmentFromClipboard();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    graph,
    graphFragmentClipboard,
    helpWorkingCopy,
    helpWorkingCopySelectedEdgeIds,
    helpWorkingCopySelectedNodeIds,
    runtimeInfo,
    runtimeSession?.snapshot.project,
    runtimeSessionSynced,
    runtimeStatus,
    runtimeUrl,
    selectedEdgeIds,
    selectedNodeIds,
    viewState
  ]);

  function openInspectSidePanel() {
    setLogsOpen(false);
    setSidePanelOpen(true);
  }

  function openLogsSidePanel() {
    setLogsOpen(true);
    setSidePanelOpen(true);
  }

  function appendClientLog(level: LogLevel, message: string) {
    const timestamp = new Date().toISOString();
    setClientLogLines((current) =>
      [
        ...current,
        clientLogLine(`studio-${timestamp}-${current.length}`, level, message, timestamp)
      ].slice(-200)
    );
  }

  function appendObjectTextDiagnostics(
    action: string,
    diagnostics: Array<{ severity: LogLevel; code: string; message: string }>
  ) {
    for (const diagnostic of diagnostics) {
      appendClientLog(diagnostic.severity, `${action}: ${diagnostic.code}: ${diagnostic.message}`);
    }
  }

  async function copySelectedGraphFragment() {
    const result = createGraphFragmentFromSelection(graph, viewState, {
      edgeIds: selectedEdgeIds,
      nodeIds: selectedNodeIds
    }, {
      id: `fragment_${Date.now()}`,
      source: "root"
    });
    if (!result.fragment) {
      const message = result.diagnostics[0]?.message ?? "No graph fragment could be copied.";
      setRuntimeError(message);
      appendClientLog("warning", message);
      return;
    }

    recordCopiedGraphFragment(result.fragment, result, "root graph");
    await writeGraphFragmentToSystemClipboard(result.fragment);
  }

  function recordCopiedGraphFragment(
    fragment: GraphFragmentV02,
    result: GraphFragmentBuildResult,
    sourceLabel: string
  ) {
    setGraphFragmentClipboard(fragment);
    if (result.omittedEdges.length > 0) {
      appendClientLog("warning", `Copied fragment omitted ${result.omittedEdges.length} selected external cable(s).`);
    }
    appendClientLog("info", `Copied ${sourceLabel} fragment with ${fragment.nodes.length} node(s).`);
  }

  async function writeGraphFragmentToSystemClipboard(fragment: GraphFragmentV02) {
    if (!navigator.clipboard?.writeText) {
      appendClientLog("warning", "Browser clipboard is unavailable; Studio kept the fragment in memory.");
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeGraphFragmentClipboard(fragment));
    } catch {
      appendClientLog("warning", "Browser clipboard write failed; Studio kept the fragment in memory.");
    }
  }

  async function pasteGraphFragmentFromClipboard(fragmentOverride?: GraphFragmentV02) {
    let fragment = fragmentOverride ?? graphFragmentClipboard;
    if (!fragmentOverride) {
      try {
        const clipboardText = await navigator.clipboard?.readText();
        const parsed = clipboardText ? parseGraphFragmentClipboard(clipboardText) : null;
        fragment = parsed ?? fragment;
      } catch {
        appendClientLog("warning", "Browser clipboard read failed; Studio used the in-memory graph fragment.");
      }
    }
    if (!fragment) {
      const message = "Copy a graph fragment before pasting.";
      setRuntimeError(message);
      appendClientLog("warning", message);
      return;
    }

    await pasteGraphFragmentToRuntime(fragment);
  }

  async function pasteGraphFragmentToRuntime(fragment: GraphFragmentV02) {
    const availability = graphFragmentPasteAvailability({
      capabilities: runtimeInfo?.capabilities,
      connected: runtimeStatus === "connected",
      sessionLoaded: runtimeSessionLoaded(runtimeSession),
      sessionSynced: runtimeSessionSynced
    });
    if (!availability.ok) {
      setRuntimeError(availability.reason);
      appendClientLog("warning", availability.reason);
      return;
    }

    const baseRevision = runtimeSession?.snapshot.project?.graph.revision ?? null;
    if (!baseRevision) {
      const message = "Runtime session graph revision is required before pasting graph fragments.";
      setRuntimeError(message);
      appendClientLog("warning", message);
      return;
    }

    const operation = createPasteGraphFragmentOperation(fragment, baseRevision);
    setRuntimeBusyAction("sessionOperation");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const response = await client.runSessionOperation(operation);
      setRuntimeResult({
        kind: "sessionOperation",
        response,
        receivedAt: new Date().toISOString()
      });
      if (!response.ok || !response.applied) {
        const message = response.diagnostics[0]?.message ?? "Runtime rejected graph fragment paste.";
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
      }
      await refreshRuntimeProjectFromRuntime(client);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime graph fragment paste failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createRuntimeClient({ baseUrl: runtimeUrl }));
      } catch {
        // Keep the original paste error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function toggleInspectSidePanel() {
    setSidePanelOpen((open) => {
      setLogsOpen(false);
      return !open;
    });
  }

  function selectSingleNode(nodeId: string | null) {
    setSelectedNodeId(nodeId);
    setSelectedNodeIds(nodeId ? [nodeId] : []);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
  }

  function addNode(definitionId: string, paramsOverride: Record<string, unknown> = {}) {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before adding or moving objects.");
      return;
    }
    const definition = nodeRegistry.find((candidate) => candidate.id === definitionId);
    if (!definition) {
      return;
    }

    const node = createGraphNodeFromDefinition(definition, graph.nodes, paramsOverride);
    const patch = { type: "addNode", node } satisfies GraphPatch;
    const nextGraph = applyPatch(graph, patch);
    setGraph(nextGraph);
    recordGraphPatches([patch]);
    setViewState((currentViewState) =>
      reconcileViewStateWithGraph(nextGraph, {
        ...currentViewState,
        canvas: {
          ...currentViewState.canvas,
          nodes: {
            ...currentViewState.canvas.nodes,
            [node.id]: {
              x: 88 + (graph.nodes.length % 2) * 300,
              y: 88 + Math.floor(graph.nodes.length / 2) * 180
            }
          }
        }
      })
    );
    selectSingleNode(node.id);
    setActiveHelpNodeId(null);
    openInspectSidePanel();
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function addNodeAtPosition(
    definitionId: string,
    position: { x: number; y: number },
    paramsOverride: Record<string, unknown> = {}
  ) {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before adding or moving objects.");
      return;
    }
    const definition = nodeRegistry.find((candidate) => candidate.id === definitionId);
    if (!definition) {
      return;
    }

    const node = createGraphNodeFromDefinition(definition, graph.nodes, paramsOverride);
    const patch = { type: "addNode", node } satisfies GraphPatch;
    const nextGraph = applyPatch(graph, patch);
    setGraph(nextGraph);
    recordGraphPatches([patch]);
    setViewState((currentViewState) =>
      reconcileViewStateWithGraph(nextGraph, {
        ...currentViewState,
        canvas: {
          ...currentViewState.canvas,
          nodes: {
            ...currentViewState.canvas.nodes,
            [node.id]: position
          }
        }
      })
    );
    selectSingleNode(node.id);
    setActiveHelpNodeId(null);
    openInspectSidePanel();
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function addObjectTextNode(objectText: string) {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before adding or moving objects.");
      return;
    }

    const result = createGraphNodeFromObjectText(objectText, graph.nodes, nodeRegistry);
    if (!result.node) {
      setRuntimeError(result.diagnostics[0]?.message ?? "Object text could not be resolved.");
      return;
    }
    appendObjectTextDiagnostics("object box create", result.diagnostics);
    const node = result.node;

    const patch = { type: "addNode", node } satisfies GraphPatch;
    const nextGraph = applyPatch(graph, patch);
    setGraph(nextGraph);
    recordGraphPatches([patch]);
    setViewState((currentViewState) =>
      reconcileViewStateWithGraph(nextGraph, {
        ...currentViewState,
        canvas: {
          ...currentViewState.canvas,
          nodes: {
            ...currentViewState.canvas.nodes,
            [node.id]: {
              x: 88 + (graph.nodes.length % 2) * 300,
              y: 88 + Math.floor(graph.nodes.length / 2) * 180
            }
          }
        }
      })
    );
    selectSingleNode(node.id);
    setActiveHelpNodeId(null);
    openInspectSidePanel();
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function replaceObjectTextNode(nodeId: string, objectText: string) {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before editing object boxes.");
      return;
    }
    const existing = graph.nodes.find((node) => node.id === nodeId);
    if (!existing) {
      setRuntimeError(`${nodeId} no longer exists.`);
      return;
    }

    const result = createGraphNodeFromObjectText(
      objectText,
      graph.nodes.filter((node) => node.id !== nodeId),
      nodeRegistry,
      { nodeId }
    );
    if (!result.node) {
      return;
    }
    appendObjectTextDiagnostics("object box edit", result.diagnostics);

    const patch = {
      type: "replaceNode",
      nodeId,
      node: result.node,
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;
    const nextGraph = applyPatch(graph, patch);
    updateGraph(nextGraph, [patch]);
    selectSingleNode(nodeId);
    setActiveHelpNodeId(null);
    openInspectSidePanel();
  }

  function updateGraph(nextGraph: GraphDocumentV01, patches: GraphPatch[] = []) {
    setGraph(nextGraph);
    setViewState((currentViewState) => reconcileViewStateWithGraph(nextGraph, currentViewState));
    recordGraphPatches(patches);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function recordGraphPatches(patches: GraphPatch[]) {
    if (patches.length === 0) {
      return;
    }

    const runtimeGraphRevision = runtimeSession?.snapshot.project?.graph.revision ?? null;
    if (runtimeStatus !== "connected" || !runtimeSessionSynced || !runtimeGraphRevision) {
      setRuntimeError("Runtime session is required before graph edits can be applied.");
      return;
    }

    const operations = patches.map(graphPatchFromStudioAction);
    setPatchConflict(null);
    void applyRuntimePatchOperations(operations, runtimeGraphRevision);
  }

  function updateViewStateFromCanvas(nextViewState: ViewStateV01) {
    setViewState(nextViewState);
    if (!nodeViewStateChanged(viewState, nextViewState)) {
      return;
    }
    void applyRuntimeViewStatePatch(nextViewState);
  }

  async function applyRuntimeViewStatePatch(nextViewState: ViewStateV01) {
    const baseViewRevision = runtimeSession?.snapshot.viewRevision ?? null;
    if (runtimeStatus !== "connected" || !runtimeSessionSynced || baseViewRevision === null) {
      setRuntimeError("Runtime session is required before object positions can be applied.");
      return;
    }
    const ops = changedNodeViewOperations(graph, viewState, nextViewState);
    if (ops.length === 0) {
      return;
    }

    setRuntimeBusyAction("mutateSession");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const response = await client.mutateSession({
        clientId: "studio-local",
        description: "move object",
        viewPatch: {
          baseViewRevision,
          ops
        }
      });
      const nextSession = runtimeSessionFromMutation(response);
      setRuntimeSession(nextSession);
      setRuntimeHistory(response.history);
      setRuntimeResult({
        kind: "mutateSession",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");

      if (response.ok && response.applied) {
        const project = response.snapshot.project;
        setViewState(project ? reconcileViewStateWithGraph(project.graph, project.viewState) : nextViewState);
        clearPendingPatch();
        return;
      }

      if (response.conflict) {
        const message =
          response.diagnostics[0]?.message ?? "Runtime rejected view patch; Studio was restored from Runtime session.";
        setPatchConflict(message);
        setRuntimeError(message);
        await refreshRuntimeProjectFromRuntime(client);
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime view patch failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createRuntimeClient({ baseUrl: runtimeUrl }));
      } catch {
        // Keep the original runtime error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function clearPendingPatch() {
    setPendingPatchOps([]);
    setPendingPatchBaseRevision(null);
    setPatchConflict(null);
  }

  async function applyRuntimePatchOperations(
    operations: GraphPatchOperationV01[],
    baseRevision: string
  ) {
    if (operations.length === 0) {
      return;
    }

    setRuntimeBusyAction("mutateSession");
    setRuntimeError(null);
    setPatchConflict(null);
    setPendingPatchOps(operations);
    setPendingPatchBaseRevision(baseRevision);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const patch = createGraphPatch(baseRevision, operations, {
        id: `patch_${Date.now()}`,
        clientId: "studio-local"
      });
      const response = await client.mutateSession({
        graphPatch: patch,
        clientId: "studio-local"
      });
      const nextSession = runtimeSessionFromMutation(response);
      setRuntimeSession(nextSession);
      setRuntimeHistory(response.history);
      setRuntimeResult({
        kind: "mutateSession",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");

      const project = response.snapshot.project;
      if (response.ok && response.applied && project) {
        acceptRuntimeGraph(project.graph, project.viewState);
        clearPendingPatch();
        if (runtimeSupportsControlState(runtimeInfo)) {
          await refreshRuntimeControlState(client);
        } else {
          setRuntimeControlState(null);
        }
        await refreshRuntimePreview(client);
        await refreshRuntimeTelemetry(client);
        return;
      }

      const message =
        response.diagnostics[0]?.message ?? "Runtime rejected graph patch; Studio was restored from Runtime session.";
      setPatchConflict(message);
      setRuntimeError(message);
      await refreshRuntimeProjectFromRuntime(client);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime patch failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createRuntimeClient({ baseUrl: runtimeUrl }));
      } catch {
        // Keep the original runtime error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function acceptRuntimeGraph(nextGraph: GraphDocumentV01, nextViewState?: ViewStateV01 | null) {
    setGraph(nextGraph);
    setViewState((currentViewState) =>
      reconcileViewStateWithGraph(nextGraph, nextViewState ?? currentViewState)
    );
    const nextSelectedNodeId =
      selectedNodeId && nextGraph.nodes.some((node) => node.id === selectedNodeId)
        ? selectedNodeId
        : nextGraph.nodes[0]?.id ?? null;
    setSelectedNodeId(nextSelectedNodeId);
    setSelectedNodeIds(nextSelectedNodeId ? [nextSelectedNodeId] : []);
    setSelectedEdgeId(null);
    setSelectedEdgeIds([]);
    setConnectionCheck(null);
    setLastLoadedGraphFingerprint(runtimeGraphFingerprint(nextGraph.id, nextGraph.revision));
  }

  async function loadProjectIntoRuntime(
    project: ReturnType<typeof createRuntimeProjectPayload>,
    nextViewState = createViewStateFromPositions(project.graph, {}),
    kind: RuntimeResultKind = "loadSession"
  ) {
    if (runtimeStatus !== "connected") {
      setRuntimeError("Connect Runtime before opening or changing a graph.");
      return;
    }

    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const response = await client.loadSession(project);
      const loadedProject = response.snapshot.project;
      if (!response.ok || !loadedProject) {
        throw new RuntimeClientError(response.diagnostics[0]?.message ?? "Runtime rejected project load.");
      }

      setRuntimeSession(response);
      setRuntimeResult({
        kind,
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      acceptRuntimeGraph(loadedProject.graph, loadedProject.viewState ?? project.viewState ?? nextViewState);
      clearPendingPatch();
      setRuntimeControlState(runtimeSupportsControlState(runtimeInfo) ? await client.getControlState() : null);
      await refreshRuntimeHistory(client);
      await refreshRuntimePreview(client);
      await refreshRuntimeTelemetry(client);
      setGeneratedShader(null);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime project load failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function fetchRuntimeOwnedProject(
    client: RuntimeClient,
    info: RuntimeInfo,
    session: RuntimeSessionResponse
  ): Promise<RuntimeSessionResponse> {
    if (!session.snapshot.project) {
      const seedProject = createRuntimeProjectPayload(sampleGraph, nodeRegistry);
      const loaded = await client.loadSession(seedProject);
      const loadedProject = loaded.snapshot.project;
      if (!loaded.ok || !loadedProject) {
        throw new RuntimeClientError(loaded.diagnostics[0]?.message ?? "Runtime rejected initial project load.");
      }
      acceptRuntimeGraph(loadedProject.graph, loadedProject.viewState);
      return loaded;
    }

    acceptRuntimeGraph(session.snapshot.project.graph, session.snapshot.project.viewState);
    return session;
  }

  async function importGraph(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = validateGraph(parsed);
      if (!result.ok) {
        setImportError(result.errors[0] ?? "Graph import failed.");
        return;
      }

      const normalizedGraph = normalizeLegacyGraphTypes(result.value);
      await loadProjectIntoRuntime(
        createRuntimeProjectPayload(normalizedGraph, nodeRegistry, createViewStateFromPositions(normalizedGraph, {})),
        createViewStateFromPositions(normalizedGraph, {})
      );
      selectSingleNode(normalizedGraph.nodes[0]?.id ?? null);
      setActiveHelpNodeId(null);
      setImportError(null);
      setConnectionCheck(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Graph import failed.");
    }
  }

  async function openProject(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const project = parseProjectDocument(JSON.parse(await file.text()) as unknown);
      await loadProjectIntoRuntime(
        createRuntimeProjectPayload(project.graph, nodeRegistry, project.viewState),
        project.viewState
      );
      selectSingleNode(project.graph.nodes[0]?.id ?? null);
      setActiveHelpNodeId(null);
      setImportError(null);
      setConnectionCheck(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Project open failed.");
    }
  }

  function exportGraph() {
    downloadJson(graph, `${graph.id || "skenion-graph"}.json`);
  }

  function saveProject() {
    downloadJson(createProjectDocument(graph, viewState), `${graph.id || "skenion-project"}.skenion.json`);
  }

  function resetSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(sampleGraph, nodeRegistry, createViewStateFromPositions(sampleGraph, {})),
      createViewStateFromPositions(sampleGraph, {})
    );
    selectSingleNode(sampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadRenderSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(renderSampleGraph, nodeRegistry, createViewStateFromPositions(renderSampleGraph, {})),
      createViewStateFromPositions(renderSampleGraph, {})
    );
    selectSingleNode(renderSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadShaderUniformSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(shaderUniformSampleGraph, nodeRegistry, shaderUniformSampleViewState),
      shaderUniformSampleViewState
    );
    selectSingleNode(shaderUniformSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadShaderMultiUniformSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(shaderMultiUniformSampleGraph, nodeRegistry, shaderMultiUniformSampleViewState),
      shaderMultiUniformSampleViewState
    );
    selectSingleNode(shaderMultiUniformSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadPortDemoSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(portDemoSampleGraph, nodeRegistry, portDemoSampleViewState),
      portDemoSampleViewState
    );
    selectSingleNode(portDemoSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadObjectRoutingPanelSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(objectRoutingPanelSampleGraph, nodeRegistry, objectRoutingPanelSampleViewState),
      objectRoutingPanelSampleViewState
    );
    selectSingleNode(objectRoutingPanelSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function removeNode(node: GraphNodeV01) {
    const patch = { type: "removeNode", nodeId: node.id } satisfies GraphPatch;
    const nextGraph = applyPatch(graph, patch);
    setGraph(nextGraph);
    setViewState((currentViewState) => reconcileViewStateWithGraph(nextGraph, currentViewState));
    recordGraphPatches([patch]);
    selectSingleNode(null);
    setActiveHelpNodeId(null);
    setRuntimeResult(null);
  }

  function setNodeParam(nodeId: string, key: string, value: unknown) {
    const patch = { type: "setNodeParam", nodeId, key, value } satisfies GraphPatch;
    setGraph((currentGraph) => applyPatch(currentGraph, patch));
    recordGraphPatches([patch]);
    setConnectionCheck(null);
    setRuntimeResult(null);
    if (key === "source") {
      setGeneratedShader(null);
    }
  }

  function setNodeParams(nodeId: string, params: Record<string, unknown>) {
    const patches = Object.entries(params).map(([key, value]) => ({
      type: "setNodeParam",
      nodeId,
      key,
      value
    }) satisfies GraphPatch);
    const nextGraph = patches.reduce((currentGraph, patch) => applyPatch(currentGraph, patch), graph);
    updateGraph(nextGraph, patches);
  }

  function syncShaderInputs(nodeId: string, source: string) {
    const patch = createReplaceShaderInterfacePatch(nodeId, source);
    if (!patch) {
      setConnectionCheck({
        ok: false,
        message: "Shader interface analysis failed. Fix annotation diagnostics before syncing inputs."
      });
      return;
    }

    setGraph((currentGraph) => applyPatch(currentGraph, patch));
    recordGraphPatches([patch]);
    setConnectionCheck(null);
    setRuntimeResult(null);
    setGeneratedShader(null);
  }

  function showNodeHelp(definitionId: string) {
    setActiveHelpNodeId(definitionId);
    selectSingleNode(null);
    openInspectSidePanel();
    setConnectionCheck(null);
  }

  function openHelpGraphAsVolatileEditableCopy(definitionId: string) {
    const helpGraph = getBuiltinNodeHelpGraph(definitionId);
    if (!helpGraph) {
      return;
    }

    const helpWorkingCopy = createVolatileHelpWorkingCopy(helpGraph, {
      sourcePatchId: definitionId
    });
    setHelpWorkingCopy(helpWorkingCopy);
    setHelpWorkingCopySelectedNodeIds([]);
    setHelpWorkingCopySelectedEdgeIds([]);
    setHelpWorkingCopySelectedNodeId(null);
    setHelpWorkingCopySelectedEdgeId(null);
    setHelpWorkingCopyConnectionCheck(null);
    appendClientLog("info", `Opened volatile editable help copy ${helpWorkingCopy.workingCopyId}.`);
  }

  function updateHelpWorkingCopyGraph(nextGraph: GraphDocumentV01) {
    setHelpWorkingCopy((current) =>
      current
        ? {
            ...current,
            graph: nextGraph,
            viewState: reconcileViewStateWithGraph(nextGraph, current.viewState)
          }
        : current
    );
    setHelpWorkingCopyConnectionCheck(null);
  }

  function updateHelpWorkingCopyViewState(nextViewState: ViewStateV01) {
    setHelpWorkingCopy((current) =>
      current
        ? {
            ...current,
            viewState: reconcileViewStateWithGraph(current.graph, nextViewState)
          }
        : current
    );
  }

  function addHelpWorkingCopyNodeAtPosition(
    definitionId: string,
    position: { x: number; y: number },
    paramsOverride: Record<string, unknown> = {}
  ) {
    if (!helpWorkingCopy) {
      return;
    }
    const definition = nodeRegistry.find((candidate) => candidate.id === definitionId);
    if (!definition) {
      return;
    }
    const node = createGraphNodeFromDefinition(definition, helpWorkingCopy.graph.nodes, paramsOverride);
    const nextGraph = applyPatch(helpWorkingCopy.graph, { type: "addNode", node });
    setHelpWorkingCopy({
      ...helpWorkingCopy,
      graph: nextGraph,
      viewState: reconcileViewStateWithGraph(nextGraph, {
        ...helpWorkingCopy.viewState,
        canvas: {
          ...helpWorkingCopy.viewState.canvas,
          nodes: {
            ...helpWorkingCopy.viewState.canvas.nodes,
            [node.id]: position
          }
        }
      })
    });
    setHelpWorkingCopySelectedNodeId(node.id);
    setHelpWorkingCopySelectedNodeIds([node.id]);
    setHelpWorkingCopySelectedEdgeId(null);
    setHelpWorkingCopySelectedEdgeIds([]);
  }

  function setHelpWorkingCopyNodeParam(nodeId: string, key: string, value: unknown) {
    if (!helpWorkingCopy) {
      return;
    }
    updateHelpWorkingCopyGraph(applyPatch(helpWorkingCopy.graph, { type: "setNodeParam", nodeId, key, value }));
  }

  function replaceHelpWorkingCopyObjectText(nodeId: string, objectText: string) {
    if (!helpWorkingCopy) {
      return;
    }
    const result = createGraphNodeFromObjectText(
      objectText,
      helpWorkingCopy.graph.nodes.filter((node) => node.id !== nodeId),
      nodeRegistry,
      { nodeId }
    );
    if (!result.node) {
      appendClientLog("warning", result.diagnostics[0]?.message ?? "Help working copy object text could not be resolved.");
      return;
    }
    appendObjectTextDiagnostics("help working copy object edit", result.diagnostics);
    updateHelpWorkingCopyGraph(
      applyPatch(helpWorkingCopy.graph, {
        type: "replaceNode",
        nodeId,
        node: result.node,
        edgePolicy: "removeInvalidEdges"
      })
    );
  }

  async function copyHelpWorkingCopySelection() {
    if (!helpWorkingCopy) {
      return null;
    }
    const result = createGraphFragmentFromSelection(
      helpWorkingCopy.graph,
      helpWorkingCopy.viewState,
      {
        edgeIds: helpWorkingCopySelectedEdgeIds,
        nodeIds: helpWorkingCopySelectedNodeIds
      },
      {
        id: `fragment_${Date.now()}`,
        source: "help-working-copy"
      }
    );
    if (!result.fragment) {
      const message = result.diagnostics[0]?.message ?? "No help working copy fragment could be copied.";
      appendClientLog("warning", message);
      return null;
    }
    recordCopiedGraphFragment(result.fragment, result, "help working copy");
    await writeGraphFragmentToSystemClipboard(result.fragment);
    return result.fragment;
  }

  async function pasteHelpWorkingCopySelectionIntoRoot() {
    const fragment = await copyHelpWorkingCopySelection();
    if (fragment) {
      await pasteGraphFragmentFromClipboard(fragment);
    }
  }

  async function connectRuntime() {
    setRuntimeBusyAction("connect");
    setRuntimeStatus("connecting");
    setRuntimeError(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const health = await client.getHealth();
      if (!health.ok) {
        throw new RuntimeClientError("Runtime health check returned not-ok.");
      }
      const info = await client.getRuntimeInfo();
      const initialSession = await client.getSession();
      const session = await fetchRuntimeOwnedProject(client, info, initialSession);
      const history = runtimeSupportsHistory(info) ? await client.getSessionHistory() : null;
      const previewStatus = runtimeSupportsPreview(info) ? await client.getPreviewStatus() : null;
      const telemetry = runtimeSupportsTelemetry(info) ? await client.getTelemetry() : null;
      const controlState =
        runtimeSessionLoaded(session) && runtimeSupportsControlState(info) ? await client.getControlState() : null;
      setRuntimeInfo(info);
      setRuntimeSession(session);
      setRuntimeControlState(controlState);
      setRuntimeHistory(history);
      setRuntimePreviewStatus(previewStatus);
      setRuntimeTelemetry(telemetry);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(runtimeSessionFingerprint(session));
      clearPendingPatch();
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeInfo(null);
      setRuntimeSession(null);
      setRuntimeControlState(null);
      setRuntimeHistory(null);
      setRuntimePreviewStatus(null);
      setRuntimeTelemetry(null);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime connection failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function runRuntimeSessionAction(
    kind: RuntimeResultKind,
    action: () => Promise<RuntimeSessionResponse>
  ) {
    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    try {
      const response = await action();
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      setRuntimeSession(response);
      setRuntimeResult({
        kind,
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      if (kind === "clearSession" && response.ok) {
        setLastLoadedGraphFingerprint(null);
        clearPendingPatch();
        setRuntimeControlState(null);
      }
      if (kind === "clearSession") {
        setGeneratedShader(null);
      }
      if (kind === "session" || kind === "clearSession") {
        await refreshRuntimeHistory(client);
        await refreshRuntimePreview(client);
      }
      if (runtimeSessionLoaded(response) && runtimeSupportsControlState(runtimeInfo)) {
        await refreshRuntimeControlState(client);
      } else if (!runtimeSessionLoaded(response)) {
        setRuntimeControlState(null);
      }
      await refreshRuntimeTelemetry(client);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function refreshRuntimeProjectFromRuntime(
    client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl }),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    const session = await client.getSession();
    const project = session.snapshot.project;
    if (!info || !project) {
      setRuntimeSession(session);
      setRuntimeControlState(null);
      setRuntimeHistory(null);
      setRuntimePreviewStatus(null);
      setRuntimeTelemetry(null);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
      return session;
    }

    acceptRuntimeGraph(project.graph, project.viewState);
    setRuntimeSession(session);
    setRuntimeControlState(runtimeSupportsControlState(info) ? await client.getControlState() : null);
    await refreshRuntimeHistory(client, info);
    await refreshRuntimePreview(client);
    await refreshRuntimeTelemetry(client);
    clearPendingPatch();
    return session;
  }

  async function refreshRuntimeHistory(
    client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl }),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    if (!runtimeSupportsHistory(info)) {
      setRuntimeHistory(null);
      return null;
    }

    const history = await client.getSessionHistory();
    setRuntimeHistory(history);
    return history;
  }

  async function refreshRuntimePreview(client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl })) {
    if (!runtimeSupportsPreview(runtimeInfo)) {
      setRuntimePreviewStatus(null);
      return null;
    }

    const previewStatus = await client.getPreviewStatus();
    setRuntimePreviewStatus(previewStatus);
    return previewStatus;
  }

  async function refreshRuntimeControlState(
    client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl }),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    if (!runtimeSupportsControlState(info)) {
      setRuntimeControlState(null);
      return null;
    }

    const controlState = await client.getControlState();
    setRuntimeControlState(controlState);
    return controlState;
  }

  async function restoreRuntimeControlStateAfterControlFailure(
    client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl }),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    try {
      await refreshRuntimeControlState(client, info);
    } catch {
      setRuntimeControlState(null);
    }
  }

  async function refreshRuntimeTelemetry(
    client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl }),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    if (!runtimeSupportsTelemetry(info)) {
      setRuntimeTelemetry(null);
      return null;
    }

    const telemetry = await client.getTelemetry();
    setRuntimeTelemetry(telemetry);
    return telemetry;
  }

  async function loadGeneratedShader() {
    if (runtimeStatus !== "connected" || !runtimeSupportsGeneratedShader(runtimeInfo)) {
      return;
    }

    setRuntimeBusyAction("generatedShader");
    setRuntimeError(null);
    try {
      const response = await createRuntimeClient({ baseUrl: runtimeUrl }).getGeneratedShader();
      setGeneratedShader(response);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime generated shader request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function importRuntimeAsset(node: GraphNodeV01, file: File) {
    if (runtimeStatus !== "connected" || !runtimeSupportsAssetImport(runtimeInfo)) {
      setRuntimeError("Runtime asset import is not available.");
      return;
    }

    setRuntimeBusyAction("assetImport");
    setRuntimeError(null);
    try {
      const response = await createRuntimeClient({ baseUrl: runtimeUrl }).importAsset(file, "video");
      if (!response.ok || !response.asset) {
        throw new RuntimeClientError(response.diagnostics[0]?.message ?? "Runtime asset import failed.");
      }
      const localMetadata = await readLocalVideoAssetMetadata(file).catch(() => ({}));
      setNodeParams(node.id, {
        assetRef: response.asset.runtimeUri,
        name: response.asset.name,
        mimeType: response.asset.mimeType,
        ...localMetadata
      });
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime asset import failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function refreshRuntimePreviewFromPanel() {
    setRuntimeBusyAction("previewStatus");
    setRuntimeError(null);
    try {
      await refreshRuntimePreview();
      await refreshRuntimeTelemetry();
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function refreshRuntimeSessionFromPanel() {
    setRuntimeBusyAction("session");
    setRuntimeError(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const response = await refreshRuntimeProjectFromRuntime(client);
      setRuntimeResult({
        kind: "session",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime session refresh failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function runRuntimePreviewAction(
    kind: "startPreview" | "stopPreview" | "restartPreview",
    action: () => Promise<RuntimePreviewStatus>
  ) {
    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    try {
      const response = await action();
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      setRuntimePreviewStatus(response);
      await refreshRuntimeTelemetry(client);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function runRuntimeHistoryShortcut(action: RuntimeHistoryShortcutAction) {
    if (runtimeBusyAction) {
      return;
    }

    const availability = runtimeHistoryActionAvailability({
      connected: runtimeStatus === "connected",
      graphLocked,
      sessionLoaded: runtimeSessionLoaded(runtimeSession),
      sessionSynced: runtimeSessionSynced,
      pendingPatchOps: pendingPatchOps.length,
      history: runtimeHistory
    });
    if (action === "undo" ? !availability.canUndo : !availability.canRedo) {
      return;
    }

    const kind = action === "undo" ? "undoPatch" : "redoPatch";
    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const response = action === "undo" ? await client.undoSessionPatch() : await client.redoSessionPatch();
      await applyRuntimeHistoryShortcutResponse(kind, response, client);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function applyRuntimeHistoryShortcutResponse(
    kind: "undoPatch" | "redoPatch",
    response: RuntimePatchResponse,
    client: RuntimeClient
  ) {
    const nextSession = runtimeSessionFromMutation(response);
    setRuntimeSession(nextSession);
    setRuntimeHistory(response.history);
    setRuntimeResult({
      kind,
      response,
      receivedAt: new Date().toISOString()
    });
    setRuntimeStatus("connected");

    const project = response.snapshot.project;
    if (response.ok && response.applied && project) {
      acceptRuntimeGraph(project.graph, project.viewState);
      clearPendingPatch();
    }

    if (runtimeSessionLoaded(nextSession) && runtimeSupportsControlState(runtimeInfo)) {
      await refreshRuntimeControlState(client);
    } else {
      setRuntimeControlState(null);
    }
    await refreshRuntimePreview(client);
    await refreshRuntimeTelemetry(client);
  }

  async function sendRuntimeControlEvent(request: RuntimeControlEventRequest) {
    if (!runtimeControlInteractionEnabled) {
      return;
    }

    setRuntimeError(null);
    applyOptimisticRuntimeControlEvent(request);
    const client = createRuntimeClient({ baseUrl: runtimeUrl });
    try {
      const response = await client.sendControlEvent(request);
      recordRuntimeControlPulses(response);
      setRuntimeResult({
        kind: "controlEvent",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      applyRuntimeControlEventResponse(response);
      if (response.controlRevision !== null) {
        setRuntimeSession((current) =>
          current
            ? {
                ...current,
                snapshot: {
                  ...current.snapshot,
                  controlRevision: response.controlRevision ?? current.snapshot.controlRevision
                }
              }
            : current
        );
        setRuntimePreviewStatus((current) =>
          current ? { ...current, controlRevision: response.controlRevision ?? current.controlRevision } : current
        );
      } else {
        await restoreRuntimeControlStateAfterControlFailure(client);
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
      await restoreRuntimeControlStateAfterControlFailure(client);
    }
  }

  function sendRuntimeLiveControlEvent(request: RuntimeControlEventRequest) {
    const queue = liveControlQueueRef.current;
    const sequence = queue.nextSequence + 1;
    queue.nextSequence = sequence;
    queue.latestSequence = sequence;
    applyOptimisticRuntimeControlEvent(request);
    queue.request = { request, sequence };
    void flushRuntimeLiveControlQueue();
  }

  function applyOptimisticRuntimeControlEvent(request: RuntimeControlEventRequest) {
    const atom = request.message.atoms[0];
    if (!atom || (request.portId !== "in" && request.portId !== "cold")) {
      return;
    }
    const shouldPropagate = request.portId === "in" && request.message.selector !== "set";

    setRuntimeControlState((current) => {
      if (!current) {
        return current;
      }
      const values = { ...current.values };
      let changed = setRuntimeControlValueIfChanged(values, request.nodeId, atom);
      if (shouldPropagate) {
        changed = propagateOptimisticValue(request.nodeId, atom, values) || changed;
      }
      return changed ? {
        ...current,
        values
      } : current;
    });
  }

  function propagateOptimisticValue(
    sourceNodeId: string,
    value: RuntimeControlValue,
    values: Record<string, RuntimeControlValue>
  ): boolean {
    const queue = [sourceNodeId];
    const visited = new Set<string>();
    let changed = false;
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);
      for (const edge of graph.edges) {
        if (edge.from.node !== nodeId || edge.from.port !== "value" || edge.to.port !== "in") {
          continue;
        }
        const targetNode = graph.nodes.find((node) => node.id === edge.to.node);
        if (!targetNode || !isOptimisticValueTarget(targetNode, value)) {
          continue;
        }
        changed = setRuntimeControlValueIfChanged(values, targetNode.id, value) || changed;
        queue.push(targetNode.id);
      }
    }
    return changed;
  }

  function isOptimisticValueTarget(node: GraphNodeV01, value: RuntimeControlValue): boolean {
    return (
      (value.type === "float" && node.kind === "core.float") ||
      (value.type === "int" && node.kind === "core.int") ||
      (value.type === "uint" && node.kind === "core.uint") ||
      (value.type === "bool" && node.kind === "core.bool") ||
      (value.type === "color" && node.kind === "core.color") ||
      (value.type === "string" && node.kind === "core.string")
    );
  }

  async function flushRuntimeLiveControlQueue() {
    const queue = liveControlQueueRef.current;
    if (queue.inFlight) {
      return;
    }

    const pendingRequest = queue.request;
    const { info, sessionLoaded, sessionSynced, status, url } = runtimeLiveStateRef.current;
    if (!pendingRequest || status !== "connected" || !sessionLoaded || !sessionSynced || !runtimeSupportsControl(info)) {
      return;
    }

    queue.request = null;
    queue.inFlight = true;
    const { request, sequence } = pendingRequest;
    try {
      const client = createRuntimeClient({ baseUrl: url });
      const response = await client.sendControlEvent(request);
      const isCurrentLiveResponse = sequence === queue.latestSequence;
      if (isCurrentLiveResponse) {
        recordRuntimeControlPulses(response);
        setRuntimeStatus("connected");
        setRuntimeError(null);
      }
      if (response.controlRevision !== null) {
        applyRuntimeControlEventResponse(response, { applyValues: isCurrentLiveResponse });
        setRuntimeSession((current) =>
          current
            ? {
                ...current,
                snapshot: {
                  ...current.snapshot,
                  controlRevision: response.controlRevision ?? current.snapshot.controlRevision
                }
              }
            : current
        );
        setRuntimePreviewStatus((current) =>
          current ? { ...current, controlRevision: response.controlRevision ?? current.controlRevision } : current
        );
      } else if (isCurrentLiveResponse) {
        await restoreRuntimeControlStateAfterControlFailure(client, info);
      }
    } catch (error) {
      if (sequence === queue.latestSequence) {
        setRuntimeStatus("error");
        setRuntimeError(error instanceof Error ? error.message : "Runtime control event failed.");
        await restoreRuntimeControlStateAfterControlFailure(createRuntimeClient({ baseUrl: url }), info);
      }
    } finally {
      queue.inFlight = false;
      if (queue.request) {
        void flushRuntimeLiveControlQueue();
      }
    }
  }

  function recordRuntimeControlPulses(response: RuntimeControlEventResponse) {
    const pulseNodeIds = response.emitted
      .filter((emission) => emission.message.selector === "bang")
      .map((emission) => emission.nodeId);
    if (pulseNodeIds.length === 0) {
      return;
    }
    const pulseKey = runtimeControlPulseCounterRef.current + 1;
    runtimeControlPulseCounterRef.current = pulseKey;
    setRuntimeControlPulses((current) => {
      const next = { ...current };
      for (const nodeId of pulseNodeIds) {
        next[nodeId] = pulseKey;
      }
      return next;
    });
  }

  function applyRuntimeControlEventResponse(
    response: RuntimeControlEventResponse,
    options: { applyValues?: boolean } = {}
  ) {
    if (response.controlRevision === null) {
      return;
    }
    const applyValues = options.applyValues ?? true;
    setRuntimeControlState((current) => {
      if (!current) {
        return current;
      }
      const values = applyValues ? { ...current.values } : current.values;
      let changed = false;
      if (applyValues) {
        for (const emission of response.emitted) {
          const atom = emission.message.atoms[0];
          if (atom && emission.portId === "value") {
            changed = setRuntimeControlValueIfChanged(values, emission.nodeId, atom) || changed;
          }
        }
      }
      const revisionChanged = response.controlRevision !== current.controlRevision;
      return changed || revisionChanged ? {
        ...current,
        controlRevision: response.controlRevision ?? current.controlRevision,
        values
      } : current;
    });
  }

  function setRuntimeControlValueIfChanged(
    values: Record<string, RuntimeControlValue>,
    nodeId: string,
    value: RuntimeControlValue
  ): boolean {
    if (runtimeControlValueEquals(values[nodeId], value)) {
      return false;
    }
    values[nodeId] = value;
    return true;
  }

  function runtimeSupportsSessionEvents(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.events.stream") ?? false;
  }

  function runtimeSupportsPreview(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.preview.status") ?? false;
  }

  function runtimeSupportsTelemetry(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.telemetry") ?? false;
  }

  function runtimeSupportsLogStream(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("runtime.logs.stream") ?? false;
  }

  function runtimeSupportsHistory(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.history") ?? false;
  }

  function runtimeSupportsControl(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.control.event") ?? false;
  }

  function runtimeSupportsControlState(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.control.state") ?? false;
  }

  function runtimeSupportsGeneratedShader(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.render.generatedShader") ?? false;
  }

  function runtimeSupportsAssetImport(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("assets.import") ?? false;
  }

  useEffect(() => {
    if (runtimeStatus !== "connected" || !runtimeSupportsTelemetry(runtimeInfo)) {
      return undefined;
    }

    let cancelled = false;
    const client = createRuntimeClient({ baseUrl: runtimeUrl });
    const refresh = async () => {
      try {
        const telemetry = await client.getTelemetry();
        if (!cancelled) {
          setRuntimeTelemetry(telemetry);
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeTelemetry(null);
          setRuntimeSession(null);
          setRuntimeControlState(null);
          setRuntimeHistory(null);
          setRuntimePreviewStatus(null);
          setGeneratedShader(null);
          setLastLoadedGraphFingerprint(null);
          clearPendingPatch();
          setRuntimeStatus("error");
          setRuntimeError(error instanceof Error ? error.message : "Runtime telemetry request failed.");
        }
      }
    };
    const interval = window.setInterval(() => {
      void refresh();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [runtimeInfo, runtimeStatus, runtimeUrl]);

  const runtimeSettingsPanel = (
    <RuntimeSettingsPanel
      busyAction={runtimeBusyAction}
      error={runtimeError}
      info={runtimeInfo}
      result={runtimeResult}
      previewStatus={runtimePreviewStatus}
      session={runtimeSession}
      sessionSynced={runtimeSessionSynced}
      status={runtimeStatus}
      url={runtimeUrl}
      onClearSession={() =>
        runRuntimeSessionAction("clearSession", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).clearSession()
        )
      }
      onConnect={connectRuntime}
      onPlanSession={() =>
        runRuntimeSessionAction("planSession", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).planSession()
        )
      }
      onRefreshSession={refreshRuntimeSessionFromPanel}
      onRunSession={() =>
        runRuntimeSessionAction("runSession", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).runSession(runtimeFrames)
        )
      }
      onUrlChange={(nextUrl) => {
        setRuntimeUrl(nextUrl);
        setRuntimeStatus("disconnected");
        setRuntimeInfo(null);
        setRuntimeResult(null);
        setRuntimeSession(null);
        setRuntimeHistory(null);
        setRuntimePreviewStatus(null);
        setRuntimeTelemetry(null);
        setGeneratedShader(null);
        setLastLoadedGraphFingerprint(null);
        clearPendingPatch();
        setRuntimeError(null);
      }}
      onRefreshPreview={refreshRuntimePreviewFromPanel}
      onRestartPreview={() =>
        runRuntimePreviewAction("restartPreview", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).restartPreview()
        )
      }
      onStartPreview={() =>
        runRuntimePreviewAction("startPreview", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).startPreview()
        )
      }
      onStopPreview={() =>
        runRuntimePreviewAction("stopPreview", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).stopPreview()
        )
      }
      onValidateSession={() =>
        runRuntimeSessionAction("validateSession", () =>
          createRuntimeClient({ baseUrl: runtimeUrl }).validateSession()
        )
      }
    />
  );

  const runtimeLogsPanel = (
    <RuntimeLogsPanel
      clientLines={clientLogLines}
      error={runtimeError}
      info={runtimeInfo}
      previewStatus={runtimePreviewStatus}
      result={runtimeResult}
      runtimeLines={runtimeStreamLogLines}
      semanticDiagnostics={semanticDiagnostics}
      session={runtimeSession}
      status={runtimeStatus}
      telemetry={runtimeTelemetry}
      validation={validation}
    />
  );

  return (
    <AppShell
      header={{ height: 58 }}
      footer={{ height: 30 }}
      navbar={{ width: 292, breakpoint: "sm" }}
      aside={sidePanelOpen ? { width: 356, breakpoint: "md" } : undefined}
      padding={0}
    >
      <Dialog
        centered
        onClose={() => setSettingsOpen(false)}
        opened={settingsOpen}
        size="xl"
        title="Settings"
      >
        {runtimeSettingsPanel}
      </Dialog>

      <AppShell.Header>
        <StudioToolbar
          graph={graph}
          runtimeGraphAvailable={runtimeGraphAvailable}
          summary={graphSummary(graph)}
          validation={validation}
          onExport={exportGraph}
          onImport={importGraph}
          onOpenProject={openProject}
          onSaveProject={saveProject}
          onLoadPortDemoSample={loadPortDemoSample}
          onLoadRenderSample={loadRenderSample}
          onLoadObjectRoutingPanelSample={loadObjectRoutingPanelSample}
          onLoadShaderMultiUniformSample={loadShaderMultiUniformSample}
          onLoadShaderUniformSample={loadShaderUniformSample}
          onReset={resetSample}
          onOpenSettings={() => setSettingsOpen(true)}
          inspectorOpen={sidePanelOpen}
          onToggleInspector={toggleInspectSidePanel}
        />
      </AppShell.Header>

      <AppShell.Footer>
        <DiagnosticsFooter
          graphLockDisabled={!runtimeGraphAvailable}
          graphLocked={graphLocked}
          onOpenLogs={openLogsSidePanel}
          onToggleGraphLock={() => setGraphLocked((locked) => !locked)}
          semanticDiagnostics={semanticDiagnostics}
          validation={validation}
        />
      </AppShell.Footer>

      <AppShell.Navbar p="md">
        {runtimeGraphAvailable ? (
          <PalettePanel
            addDisabled={graphLocked}
            registry={nodeRegistry}
            onAddNode={addNode}
            onAddObjectText={addObjectTextNode}
            onShowHelp={showNodeHelp}
          />
        ) : (
          <RuntimeRequiredPanel status={runtimeStatus} />
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="studio-main">
          {importError ? (
            <Alert
              className="studio-alert"
              color="red"
              icon={<CircleAlert size={18} />}
            >
              <Group gap="xs" justify="space-between" wrap="nowrap">
                <Group gap="xs">
                  <Text fw={700}>Import failed</Text>
                  <Text>{importError}</Text>
                </Group>
                <IconButton
                  icon={<X size={14} />}
                  label="Dismiss import error"
                  onClick={() => setImportError(null)}
                  size="sm"
                />
              </Group>
            </Alert>
          ) : null}
          {runtimeGraphAvailable ? (
            <GraphCanvas
              graph={graph}
              graphLocked={graphLocked}
              viewState={viewState}
              onAddNodeAtPosition={addNodeAtPosition}
              onConnectionCheck={setConnectionCheck}
              onGraphChange={updateGraph}
              onImportAsset={importRuntimeAsset}
              onObjectControl={(nodeId, portId, message) => {
                void sendRuntimeControlEvent({
                  nodeId,
                  portId: portId as RuntimeControlEventRequest["portId"],
                  message
                });
              }}
              onObjectLiveControl={(nodeId, portId, message) => {
                sendRuntimeLiveControlEvent({
                  nodeId,
                  portId: portId as RuntimeControlEventRequest["portId"],
                  message
                });
              }}
              onObjectParamChange={setNodeParam}
              onObjectTextCommit={replaceObjectTextNode}
              runtimeControlEnabled={runtimeControlInteractionEnabled}
              runtimeControlPulses={runtimeControlPulses}
              runtimeControlValues={runtimeSessionSynced ? runtimeControlState?.values ?? {} : {}}
              onViewStateChange={updateViewStateFromCanvas}
              onSelectedEdgeChange={(edgeId) => {
                setSelectedEdgeId(edgeId);
                if (edgeId) {
                  setActiveHelpNodeId(null);
                  openInspectSidePanel();
                }
              }}
              onSelectedEdgesChange={setSelectedEdgeIds}
              onSelectedNodeChange={(nodeId) => {
                setSelectedNodeId(nodeId);
                if (nodeId) {
                  setActiveHelpNodeId(null);
                  openInspectSidePanel();
                }
              }}
              onSelectedNodesChange={setSelectedNodeIds}
              onShowNodeHelp={showNodeHelp}
              selectedEdgeId={selectedEdgeId}
              selectedEdgeIds={selectedEdgeIds}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={selectedNodeIds}
            />
          ) : (
            <RuntimeRequiredCanvas status={runtimeStatus} />
          )}
        </div>
      </AppShell.Main>

      {sidePanelOpen ? (
        <AppShell.Aside
          onClickCapture={(event) => {
            const leftEdge = event.currentTarget.getBoundingClientRect().left;
            if (event.clientX - leftEdge <= 6) {
              event.preventDefault();
              event.stopPropagation();
              setInspectorEdgeHovered(false);
              setLogsOpen(false);
              setSidePanelOpen(false);
            }
          }}
          onMouseLeave={() => setInspectorEdgeHovered(false)}
          onMouseMoveCapture={(event) => {
            const leftEdge = event.currentTarget.getBoundingClientRect().left;
            const edgeHovered = event.clientX - leftEdge <= 6;
            setInspectorEdgeHovered((current) => current === edgeHovered ? current : edgeHovered);
          }}
          p="md"
          style={{ cursor: inspectorEdgeHovered ? "pointer" : undefined }}
        >
          <ScrollArea className="aside-scroll" offsetScrollbars>
            {logsOpen ? (
              runtimeLogsPanel
            ) : runtimeGraphAvailable ? (
              <InspectorPanel
                connectionCheck={connectionCheck}
                generatedShader={generatedShader}
                generatedShaderBusy={runtimeBusyAction === "generatedShader"}
                graph={graph}
                graphLocked={graphLocked}
                edge={selectedEdge}
                helpNodeId={activeHelpNodeId}
                node={selectedNode}
                onImportAsset={importRuntimeAsset}
                onHelpClipboardWriteError={(message) => appendClientLog("warning", message)}
                onHelpCopyFragment={(fragment, result) => recordCopiedGraphFragment(fragment, result, "help source")}
                onHelpCopyFragmentError={(message) => appendClientLog("warning", message)}
                onLoadGeneratedShader={runtimeSupportsGeneratedShader(runtimeInfo) ? loadGeneratedShader : undefined}
                onOpenHelpGraph={openHelpGraphAsVolatileEditableCopy}
                onRemoveNode={removeNode}
                onSetNodeParam={setNodeParam}
                onSyncShaderInputs={syncShaderInputs}
                runtimeAssetImportBusy={runtimeBusyAction === "assetImport"}
                runtimeAssetImportEnabled={runtimeStatus === "connected" && runtimeSupportsAssetImport(runtimeInfo)}
                runtimeShaderDiagnostics={selectedRuntimeShaderDiagnostics}
                semanticDiagnostics={semanticDiagnostics}
              />
            ) : (
              <RuntimeRequiredPanel status={runtimeStatus} />
            )}
          </ScrollArea>
        </AppShell.Aside>
      ) : null}

      <Dialog
        closeLabel="Close help working copy"
        onClose={() => setHelpWorkingCopy(null)}
        opened={Boolean(helpWorkingCopy)}
        size="95vw"
        title={
          helpWorkingCopy
            ? `Volatile help copy: ${helpWorkingCopy.sourcePatchId ?? helpWorkingCopy.workingCopyId}`
            : "Volatile help copy"
        }
      >
        {helpWorkingCopy ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <Group gap="xs">
                <Badge color="orange" variant="light">
                  Volatile
                </Badge>
                <Text c="dimmed" size="sm">
                  Local editable working copy. Source help cannot be saved back.
                </Text>
              </Group>
              <Group gap="xs">
                <CoreButton onClick={() => void copyHelpWorkingCopySelection()} size="compact-sm" variant="light">
                  Copy selection
                </CoreButton>
                <CoreButton onClick={() => void pasteHelpWorkingCopySelectionIntoRoot()} size="compact-sm">
                  Paste selection into current graph
                </CoreButton>
              </Group>
            </Group>
            {helpWorkingCopyConnectionCheck ? (
              <Alert color={helpWorkingCopyConnectionCheck.ok ? "blue" : "red"} variant="light">
                {helpWorkingCopyConnectionCheck.message}
              </Alert>
            ) : null}
            <div className="help-working-copy-editor" style={{ height: "64vh", minHeight: 460 }}>
              <GraphCanvas
                graph={helpWorkingCopy.graph}
                graphLocked={false}
                onAddNodeAtPosition={addHelpWorkingCopyNodeAtPosition}
                onConnectionCheck={setHelpWorkingCopyConnectionCheck}
                onGraphChange={updateHelpWorkingCopyGraph}
                onObjectParamChange={setHelpWorkingCopyNodeParam}
                onObjectTextCommit={replaceHelpWorkingCopyObjectText}
                onSelectedEdgeChange={setHelpWorkingCopySelectedEdgeId}
                onSelectedEdgesChange={setHelpWorkingCopySelectedEdgeIds}
                onSelectedNodeChange={setHelpWorkingCopySelectedNodeId}
                onSelectedNodesChange={setHelpWorkingCopySelectedNodeIds}
                onViewStateChange={updateHelpWorkingCopyViewState}
                selectedEdgeId={helpWorkingCopySelectedEdgeId}
                selectedEdgeIds={helpWorkingCopySelectedEdgeIds}
                selectedNodeId={helpWorkingCopySelectedNodeId}
                selectedNodeIds={helpWorkingCopySelectedNodeIds}
                viewState={helpWorkingCopy.viewState}
              />
            </div>
          </Stack>
        ) : null}
      </Dialog>
    </AppShell>
  );
}

function createPasteGraphFragmentOperation(
  fragment: GraphFragmentV02,
  baseRevision: string
): RuntimeOperationEnvelope {
  const operation: RuntimeOperationEnvelope = {
    schema: "skenion.runtime.operation",
    schemaVersion: "0.1.0",
    id: `operation_${Date.now()}`,
    kind: "pasteGraphFragment",
    request: {
      target: {
        path: { kind: "root" },
        baseRevision
      },
      fragment,
      options: {
        idConflictPolicy: "remap",
        outsideEndpointPolicy: "omit",
        preserveRelativePositions: true
      }
    }
  };
  const validation = validateRuntimeOperationEnvelope(operation);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }
  return validation.value;
}

function isHelpGraphViewerTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(".help-graph-viewer"));
}

function isHelpWorkingCopyTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest(".help-working-copy-editor"));
}

function nodeViewStateChanged(before: ViewStateV01, after: ViewStateV01): boolean {
  return JSON.stringify(before.canvas.nodes) !== JSON.stringify(after.canvas.nodes);
}

function changedNodeViewOperations(
  graph: GraphDocumentV01,
  before: ViewStateV01,
  after: ViewStateV01
): RuntimeViewPatchOperation[] {
  const beforeView = reconcileViewStateWithGraph(graph, before);
  const afterView = reconcileViewStateWithGraph(graph, after);
  return Object.entries(afterView.canvas.nodes)
    .filter(([nodeId, nodeView]) => JSON.stringify(beforeView.canvas.nodes[nodeId]) !== JSON.stringify(nodeView))
    .map(([nodeId, to]) => ({
      op: "moveNodeView",
      nodeId,
      from: beforeView.canvas.nodes[nodeId],
      to
    }));
}

async function readLocalVideoAssetMetadata(file: File): Promise<Record<string, unknown>> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const displaySize = videoAssetSizeForSource(sourceWidth, sourceHeight);

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForMediaEvent(video, "loadeddata");
    }

    const seekTime = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(0.12, video.duration * 0.02)
      : 0;
    if (seekTime > 0) {
      video.currentTime = seekTime;
      await waitForMediaEvent(video, "seeked");
    }

    const canvas = document.createElement("canvas");
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        ...displaySize,
        sourceHeight,
        sourceWidth
      };
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      ...displaySize,
      sourceHeight,
      sourceWidth,
      thumbnailDataUrl: canvas.toDataURL("image/jpeg", 0.82)
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function runtimeSessionLoaded(session: RuntimeSessionResponse | null): boolean {
  return Boolean(session?.snapshot.project);
}

function runtimeSessionFromMutation(response: RuntimePatchResponse): RuntimeSessionResponse {
  return {
    ok: response.ok,
    snapshot: response.snapshot,
    diagnostics: response.diagnostics,
    report: null
  };
}

function runtimeSessionFromEvent(event: RuntimeSessionEvent): RuntimeSessionResponse {
  return {
    ok: true,
    snapshot: event.snapshot,
    diagnostics: event.diagnostics,
    report: null
  };
}

function waitForMediaEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, 6000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video metadata could not be loaded."));
    };

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function RuntimeRequiredPanel({ status }: { status: RuntimeConnectionStatus }) {
  return (
    <Stack className="panel-shell" gap="sm">
      <Text fw={800} size="sm">
        Runtime Required
      </Text>
      <Text c="dimmed" size="xs">
        Connect to Runtime before adding or editing graph objects.
      </Text>
      <Badge color={status === "error" ? "red" : "gray"} variant="light">
        {status}
      </Badge>
    </Stack>
  );
}

function RuntimeRequiredCanvas({ status }: { status: RuntimeConnectionStatus }) {
  return (
    <div style={{ display: "grid", height: "100%", padding: 24, placeItems: "center" }}>
      <Alert color={status === "error" ? "red" : "gray"} variant="light">
        <Text fw={800}>Runtime session required</Text>
        <Text c="dimmed" size="sm">
          Studio displays the graph owned by Runtime. Connect to Runtime to initialize or restore the current session graph.
        </Text>
      </Alert>
    </div>
  );
}

function upsertBoundedLogLine(lines: LogLine[], line: LogLine): LogLine[] {
  return [...lines.filter((current) => current.id !== line.id), line].slice(-200);
}

function downloadJson(jsonDocument: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(jsonDocument, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
