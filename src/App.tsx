import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppShell, Badge, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { CircleAlert } from "lucide-react";
import {
  getBuiltinNodeHelpGraph,
  type GraphDocumentV01,
  type GraphNodeV01,
  type GraphPatchHistoryV01,
  type GraphPatchOperationV01
} from "@skenion/contracts";
import { GraphCanvas } from "./components/GraphCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { PalettePanel } from "./components/PalettePanel";
import { RuntimePanel } from "./components/RuntimePanel";
import { StudioToolbar } from "./components/StudioToolbar";
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
import {
  analyzeGraphPortSemantics,
  findEdgeInspectorModel
} from "./graph/portSemantics";
import {
  createGraphPatch,
  graphPatchFromStudioAction
} from "./graph/graphPatch";
import { createReplaceShaderInterfacePatch } from "./graph/fullscreenShader";
import {
  createRuntimeClient,
  DEFAULT_RUNTIME_URL,
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
  RuntimeInfo,
  RuntimeResultKind,
  RuntimePatchResponse,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "./runtime/types";

export default function App() {
  const [graph, setGraph] = useState<GraphDocumentV01>(sampleGraph);
  const [viewState, setViewState] = useState(() => createViewStateFromPositions(sampleGraph, {}));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("value_1");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeHelpNodeId, setActiveHelpNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
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
  const [runtimeHistory, setRuntimeHistory] = useState<GraphPatchHistoryV01 | null>(null);
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
    Boolean(runtimeSession?.loaded) &&
    runtimeSupportsControl(runtimeInfo) &&
    runtimeSupportsControlState(runtimeInfo);
  const runtimeGraphAvailable =
    runtimeStatus === "connected" &&
    runtimeSessionSynced &&
    Boolean(runtimeSession?.loaded);
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
    sessionLoaded: Boolean(runtimeSession?.loaded),
    sessionSynced: runtimeSessionSynced,
    status: runtimeStatus,
    url: runtimeUrl
  });

  useEffect(() => {
    runtimeLiveStateRef.current = {
      info: runtimeInfo,
      sessionLoaded: Boolean(runtimeSession?.loaded),
      sessionSynced: runtimeSessionSynced,
      status: runtimeStatus,
      url: runtimeUrl
    };
  }, [runtimeInfo, runtimeSession?.loaded, runtimeSessionSynced, runtimeStatus, runtimeUrl]);

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
    setSelectedNodeId(node.id);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
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
    setSelectedNodeId(node.id);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function addObjectTextNode(objectText: string) {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before adding or moving objects.");
      return;
    }

    const result = createGraphNodeFromObjectText(objectText, graph.nodes, nodeRegistry);
    if (!result.ok || !result.node) {
      setRuntimeError(result.diagnostics[0]?.message ?? "Object text could not be resolved.");
      return;
    }
    const node = result.node;
    if (!nodeRegistry.some((definition) => definition.id === node.kind)) {
      setRuntimeError(`${node.kind} is not available in the local node registry.`);
      return;
    }

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
    setSelectedNodeId(node.id);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
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

    const runtimeGraphRevision = runtimeSession?.graphRevision ?? null;
    if (runtimeStatus !== "connected" || !runtimeSessionSynced || !runtimeGraphRevision) {
      setRuntimeError("Runtime session is required before graph edits can be applied.");
      return;
    }

    const operations = patches.map(graphPatchFromStudioAction);
    setPatchConflict(null);
    void applyRuntimePatchOperations(operations, runtimeGraphRevision);
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

    setRuntimeBusyAction("applyPatch");
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
      const response = await client.applySessionPatch(patch);
      setRuntimeSession(response.session);
      setRuntimeHistory(response.history);
      setRuntimeResult({
        kind: "applyPatch",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");

      if (response.ok && response.applied && response.graph) {
        acceptRuntimeGraph(response.graph);
        clearPendingPatch();
        if (response.session.loaded && runtimeSupportsControlState(runtimeInfo)) {
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

  function acceptRuntimeGraph(nextGraph: GraphDocumentV01) {
    setGraph(nextGraph);
    setViewState((currentViewState) => reconcileViewStateWithGraph(nextGraph, currentViewState));
    setSelectedNodeId((current) =>
      current && nextGraph.nodes.some((node) => node.id === current) ? current : nextGraph.nodes[0]?.id ?? null
    );
    setSelectedEdgeId(null);
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
      if (!response.ok || !response.loaded) {
        throw new RuntimeClientError(response.diagnostics[0]?.message ?? "Runtime rejected project load.");
      }

      setRuntimeSession(response);
      setRuntimeResult({
        kind,
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      acceptRuntimeGraph(project.graph);
      setViewState(reconcileViewStateWithGraph(project.graph, nextViewState));
      clearPendingPatch();
      setRuntimeControlState(runtimeSupportsControlState(runtimeInfo) ? await client.getControlState() : null);
      if (runtimeSupportsHistory(runtimeInfo)) {
        await refreshRuntimeHistory(client);
      }
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
    if (!session.loaded) {
      const seedProject = createRuntimeProjectPayload(sampleGraph, nodeRegistry);
      const loaded = await client.loadSession(seedProject);
      if (!loaded.ok || !loaded.loaded) {
        throw new RuntimeClientError(loaded.diagnostics[0]?.message ?? "Runtime rejected initial project load.");
      }
      acceptRuntimeGraph(seedProject.graph);
      setViewState(createViewStateFromPositions(seedProject.graph, {}));
      return loaded;
    }

    if (!runtimeSupportsSessionProject(info)) {
      throw new RuntimeClientError("Runtime does not expose the canonical session project.");
    }

    const projectResponse = await client.getSessionProject();
    if (!projectResponse.ok || !projectResponse.loaded || !projectResponse.project) {
      throw new RuntimeClientError(projectResponse.diagnostics[0]?.message ?? "Runtime session project is unavailable.");
    }

    acceptRuntimeGraph(projectResponse.project.graph);
    return projectResponse.session;
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
        createRuntimeProjectPayload(normalizedGraph, nodeRegistry),
        createViewStateFromPositions(normalizedGraph, {})
      );
      setSelectedNodeId(normalizedGraph.nodes[0]?.id ?? null);
      setActiveHelpNodeId(null);
      setSelectedEdgeId(null);
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
        createRuntimeProjectPayload(project.graph, nodeRegistry),
        project.viewState
      );
      setSelectedNodeId(project.graph.nodes[0]?.id ?? null);
      setActiveHelpNodeId(null);
      setSelectedEdgeId(null);
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
      createRuntimeProjectPayload(sampleGraph, nodeRegistry),
      createViewStateFromPositions(sampleGraph, {})
    );
    setSelectedNodeId(sampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadRenderSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(renderSampleGraph, nodeRegistry),
      createViewStateFromPositions(renderSampleGraph, {})
    );
    setSelectedNodeId(renderSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadShaderUniformSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(shaderUniformSampleGraph, nodeRegistry),
      shaderUniformSampleViewState
    );
    setSelectedNodeId(shaderUniformSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadShaderMultiUniformSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(shaderMultiUniformSampleGraph, nodeRegistry),
      shaderMultiUniformSampleViewState
    );
    setSelectedNodeId(shaderMultiUniformSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadPortDemoSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(portDemoSampleGraph, nodeRegistry),
      portDemoSampleViewState
    );
    setSelectedNodeId(portDemoSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadObjectRoutingPanelSample() {
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(objectRoutingPanelSampleGraph, nodeRegistry),
      objectRoutingPanelSampleViewState
    );
    setSelectedNodeId(objectRoutingPanelSampleGraph.nodes[0]?.id ?? null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
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
    setSelectedNodeId(null);
    setActiveHelpNodeId(null);
    setSelectedEdgeId(null);
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
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectionCheck(null);
  }

  function openHelpGraphAsNewGraph(definitionId: string) {
    const helpGraph = getBuiltinNodeHelpGraph(definitionId);
    if (!helpGraph) {
      return;
    }
    if (!window.confirm("Open this help patch as the current editable graph? Unsaved local edits will be replaced.")) {
      return;
    }

    const nextGraph = cloneGraph(helpGraph);
    const editableGraph = {
      ...nextGraph,
      id: `${nextGraph.id}-copy`,
      revision: "1"
    };
    void loadProjectIntoRuntime(
      createRuntimeProjectPayload(editableGraph, nodeRegistry),
      createViewStateFromPositions(editableGraph, {})
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActiveHelpNodeId(null);
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
    setGeneratedShader(null);
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
        session.loaded && runtimeSupportsControlState(info) ? await client.getControlState() : null;
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
      if ((kind === "session" || kind === "clearSession") && runtimeSupportsHistory(runtimeInfo)) {
        await refreshRuntimeHistory(client);
      }
      if (kind === "session" || kind === "clearSession") {
        await refreshRuntimePreview(client);
      }
      if (response.loaded && runtimeSupportsControlState(runtimeInfo)) {
        await refreshRuntimeControlState(client);
      } else if (!response.loaded) {
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
    if (!info || !session.loaded) {
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

    if (!runtimeSupportsSessionProject(info)) {
      throw new RuntimeClientError("Runtime does not expose the canonical session project.");
    }

    const project = await client.getSessionProject();
    if (!project.ok || !project.loaded || !project.project) {
      throw new RuntimeClientError(project.diagnostics[0]?.message ?? "Runtime session project is unavailable.");
    }

    acceptRuntimeGraph(project.project.graph);
    setRuntimeSession(project.session);
    setRuntimeControlState(project.session.loaded && runtimeSupportsControlState(info) ? await client.getControlState() : null);
    if (runtimeSupportsHistory(info)) {
      await refreshRuntimeHistory(client);
    }
    await refreshRuntimePreview(client);
    await refreshRuntimeTelemetry(client);
    clearPendingPatch();
    return project.session;
  }

  async function refreshRuntimeHistory(client: RuntimeClient = createRuntimeClient({ baseUrl: runtimeUrl })) {
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
      setNodeParams(node.id, {
        assetRef: response.asset.runtimeUri,
        name: response.asset.name,
        mimeType: response.asset.mimeType
      });
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime asset import failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function refreshRuntimeHistoryFromPanel() {
    setRuntimeBusyAction("refreshHistory");
    setRuntimeError(null);
    try {
      await refreshRuntimeHistory();
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
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

  async function runRuntimePatchHistoryAction(
    kind: "undoPatch" | "redoPatch",
    action: () => Promise<RuntimePatchResponse>
  ) {
    if (pendingPatchOps.length > 0) {
      return;
    }

    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const response = await action();
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      setRuntimeSession(response.session);
      setRuntimeHistory(response.history);
      if (response.session.loaded && runtimeSupportsControlState(runtimeInfo)) {
        await refreshRuntimeControlState(client);
      } else {
        setRuntimeControlState(null);
      }
      await refreshRuntimePreview(client);
      await refreshRuntimeTelemetry(client);
      setRuntimeResult({
        kind,
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      if (response.ok && response.applied && response.graph) {
        acceptRuntimeGraph(response.graph);
        clearPendingPatch();
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
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
          current ? { ...current, controlRevision: response.controlRevision ?? current.controlRevision } : current
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
          current ? { ...current, controlRevision: response.controlRevision ?? current.controlRevision } : current
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

  function runtimeSupportsHistory(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.history") ?? false;
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

  function runtimeSupportsSessionProject(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.project") ?? false;
  }

  function runtimeSupportsPreview(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.preview.status") ?? false;
  }

  function runtimeSupportsTelemetry(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.telemetry") ?? false;
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

  return (
    <AppShell
      header={{ height: 58 }}
      navbar={{ width: 292, breakpoint: "sm" }}
      aside={inspectorOpen ? { width: 356, breakpoint: "md" } : undefined}
      padding={0}
    >
      <AppShell.Header>
        <StudioToolbar
          graph={graph}
          graphLocked={graphLocked}
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
          onToggleGraphLock={() => setGraphLocked((locked) => !locked)}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((open) => !open)}
        />
      </AppShell.Header>

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
              onClose={() => setImportError(null)}
              withCloseButton
            >
              <Group gap="xs">
                <Text fw={700}>Import failed</Text>
                <Text>{importError}</Text>
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
              runtimeControlEnabled={runtimeControlInteractionEnabled}
              runtimeControlPulses={runtimeControlPulses}
              runtimeControlValues={runtimeSessionSynced ? runtimeControlState?.values ?? {} : {}}
              onViewStateChange={setViewState}
              onSelectedEdgeChange={(edgeId) => {
                setSelectedEdgeId(edgeId);
                if (edgeId) {
                  setActiveHelpNodeId(null);
                }
              }}
              onSelectedNodeChange={(nodeId) => {
                setSelectedNodeId(nodeId);
                if (nodeId) {
                  setActiveHelpNodeId(null);
                }
              }}
              onShowNodeHelp={showNodeHelp}
              selectedEdgeId={selectedEdgeId}
              selectedNodeId={selectedNodeId}
            />
          ) : (
            <RuntimeRequiredCanvas status={runtimeStatus} />
          )}
        </div>
      </AppShell.Main>

      {inspectorOpen ? (
      <AppShell.Aside p="md">
        <ScrollArea className="aside-scroll" offsetScrollbars>
          <Stack gap="md">
            <RuntimePanel
              busyAction={runtimeBusyAction}
              error={runtimeError}
              info={runtimeInfo}
              result={runtimeResult}
              history={runtimeHistory}
              previewStatus={runtimePreviewStatus}
              session={runtimeSession}
              sessionSynced={runtimeSessionSynced}
              telemetry={runtimeTelemetry}
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
              onRedoPatch={() =>
                runRuntimePatchHistoryAction("redoPatch", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).redoSessionPatch()
                )
              }
              onRefreshHistory={refreshRuntimeHistoryFromPanel}
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
              onUndoPatch={() =>
                runRuntimePatchHistoryAction("undoPatch", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).undoSessionPatch()
                )
              }
              onValidateSession={() =>
                runRuntimeSessionAction("validateSession", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).validateSession()
                )
              }
            />
            {runtimeGraphAvailable ? (
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
                onLoadGeneratedShader={runtimeSupportsGeneratedShader(runtimeInfo) ? loadGeneratedShader : undefined}
                onOpenHelpGraph={openHelpGraphAsNewGraph}
                onRemoveNode={removeNode}
                onSendRuntimeControl={(request) => {
                  void sendRuntimeControlEvent(request);
                }}
                onSetNodeParam={setNodeParam}
                onSyncShaderInputs={syncShaderInputs}
                runtimeControlBusy={runtimeBusyAction === "controlEvent"}
                runtimeControlEnabled={
                  runtimeStatus === "connected" &&
                  Boolean(runtimeSession?.loaded) &&
                  runtimeSupportsControl(runtimeInfo)
                }
                runtimeAssetImportBusy={runtimeBusyAction === "assetImport"}
                runtimeAssetImportEnabled={runtimeStatus === "connected" && runtimeSupportsAssetImport(runtimeInfo)}
                runtimeShaderDiagnostics={selectedRuntimeShaderDiagnostics}
                semanticDiagnostics={semanticDiagnostics}
                validation={validation}
              />
            ) : null}
          </Stack>
        </ScrollArea>
      </AppShell.Aside>
      ) : null}
    </AppShell>
  );
}

function cloneGraph(graph: GraphDocumentV01): GraphDocumentV01 {
  return JSON.parse(JSON.stringify(graph)) as GraphDocumentV01;
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
      <Badge color={status === "error" ? "red" : "gray"} radius="sm" variant="light">
        {status}
      </Badge>
    </Stack>
  );
}

function RuntimeRequiredCanvas({ status }: { status: RuntimeConnectionStatus }) {
  return (
    <div style={{ display: "grid", height: "100%", padding: 24, placeItems: "center" }}>
      <Alert color={status === "error" ? "red" : "gray"} radius="sm" variant="light">
        <Text fw={800}>Runtime session required</Text>
        <Text c="dimmed" size="sm">
          Studio displays the graph owned by Runtime. Connect to Runtime to initialize or restore the current session graph.
        </Text>
      </Alert>
    </div>
  );
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
