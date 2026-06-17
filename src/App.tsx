import { useEffect, useMemo, useState } from "react";
import { Alert, AppShell, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { CircleAlert } from "lucide-react";
import type {
  GraphDocumentV01,
  GraphNodeV01,
  GraphPatchHistoryV01,
  GraphPatchOperationV01
} from "@skenion/contracts";
import { GraphCanvas } from "./components/GraphCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { PalettePanel } from "./components/PalettePanel";
import { RuntimePanel } from "./components/RuntimePanel";
import { StudioToolbar } from "./components/StudioToolbar";
import { nodeRegistry } from "./data/registry";
import {
  portDemoSampleGraph,
  portDemoSamplePositions,
  renderSampleGraph,
  sampleGraph,
  shaderMultiUniformSampleGraph,
  shaderMultiUniformSamplePositions,
  shaderUniformSampleGraph,
  shaderUniformSamplePositions
} from "./data/sampleGraph";
import {
  applyPatch,
  createGraphNodeFromDefinition,
  graphSummary,
  normalizeLegacyGraphTypes,
  validateGraph,
  type ConnectionCheck,
  type GraphPatch,
  type ViewPositions
} from "./graph/skenionGraph";
import {
  analyzeGraphPortSemantics,
  findEdgeInspectorModel
} from "./graph/portSemantics";
import {
  createGraphPatch,
  graphPatchFromStudioAction
} from "./graph/graphPatch";
import {
  createRuntimeClient,
  DEFAULT_RUNTIME_URL,
  RuntimeClientError,
  type RuntimeClient
} from "./runtime/client";
import { createRuntimeProjectPayload } from "./runtime/payload";
import {
  nextLoadedGraphFingerprint,
  runtimeGraphFingerprint,
  runtimeSessionIsSynced
} from "./runtime/sessionSync";
import type {
  RuntimeActionResult,
  RuntimeApiResponse,
  RuntimeConnectionStatus,
  RuntimeControlEventRequest,
  RuntimeInfo,
  RuntimeResultKind,
  RuntimePatchResponse,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "./runtime/types";

export default function App() {
  const [graph, setGraph] = useState<GraphDocumentV01>(sampleGraph);
  const [positions, setPositions] = useState<ViewPositions>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("value_1");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheck | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [runtimeUrl, setRuntimeUrl] = useState(DEFAULT_RUNTIME_URL);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeConnectionStatus>("disconnected");
  const [runtimeBusyAction, setRuntimeBusyAction] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeFrames, setRuntimeFrames] = useState(2);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [runtimeResult, setRuntimeResult] = useState<RuntimeActionResult | null>(null);
  const [runtimeSession, setRuntimeSession] = useState<RuntimeSessionResponse | null>(null);
  const [runtimeHistory, setRuntimeHistory] = useState<GraphPatchHistoryV01 | null>(null);
  const [runtimePreviewStatus, setRuntimePreviewStatus] = useState<RuntimePreviewStatus | null>(null);
  const [runtimeTelemetry, setRuntimeTelemetry] = useState<RuntimeTelemetrySnapshot | null>(null);
  const [lastLoadedGraphFingerprint, setLastLoadedGraphFingerprint] = useState<string | null>(null);
  const [pendingPatchOps, setPendingPatchOps] = useState<GraphPatchOperationV01[]>([]);
  const [pendingPatchBaseRevision, setPendingPatchBaseRevision] = useState<string | null>(null);
  const [patchConflict, setPatchConflict] = useState<string | null>(null);
  const validation = useMemo(() => validateGraph(graph), [graph]);
  const semanticDiagnostics = useMemo(() => analyzeGraphPortSemantics(graph), [graph]);
  const runtimeProject = useMemo(() => createRuntimeProjectPayload(graph, nodeRegistry), [graph]);
  const currentGraphFingerprint = useMemo(
    () => runtimeGraphFingerprint(graph.id, graph.revision),
    [graph.id, graph.revision]
  );
  const runtimeSessionSynced = runtimeSessionIsSynced(
    runtimeStatus,
    runtimeSession,
    currentGraphFingerprint,
    lastLoadedGraphFingerprint
  );
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => findEdgeInspectorModel(graph, selectedEdgeId),
    [graph, selectedEdgeId]
  );

  function addNode(definitionId: string) {
    const definition = nodeRegistry.find((candidate) => candidate.id === definitionId);
    if (!definition) {
      return;
    }

    const node = createGraphNodeFromDefinition(definition, graph.nodes);
    const patch = { type: "addNode", node } satisfies GraphPatch;
    setGraph((currentGraph) => applyPatch(currentGraph, { type: "addNode", node }));
    recordGraphPatches([patch]);
    setPositions((currentPositions) => ({
      ...currentPositions,
      [node.id]: {
        x: 88 + (graph.nodes.length % 2) * 300,
        y: 88 + Math.floor(graph.nodes.length / 2) * 180
      }
    }));
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
    setSelectedEdgeId(null);
  }

  function updateGraph(nextGraph: GraphDocumentV01, patches: GraphPatch[] = []) {
    setGraph(nextGraph);
    recordGraphPatches(patches);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function recordGraphPatches(patches: GraphPatch[]) {
    if (patches.length === 0) {
      return;
    }

    const runtimeGraphRevision = runtimeSession?.graphRevision ?? null;
    const baseRevision = pendingPatchBaseRevision ?? runtimeGraphRevision;
    const canQueuePatch = pendingPatchBaseRevision !== null || runtimeSessionSynced;
    if (!canQueuePatch || !baseRevision) {
      return;
    }

    const operations = patches.map(graphPatchFromStudioAction);
    setPendingPatchOps((current) => [...current, ...operations]);
    setPendingPatchBaseRevision((current) => current ?? baseRevision);
    setPatchConflict(null);
  }

  function clearPendingPatch() {
    setPendingPatchOps([]);
    setPendingPatchBaseRevision(null);
    setPatchConflict(null);
  }

  function acceptRuntimeGraph(nextGraph: GraphDocumentV01) {
    setGraph(nextGraph);
    setSelectedNodeId((current) =>
      current && nextGraph.nodes.some((node) => node.id === current) ? current : nextGraph.nodes[0]?.id ?? null
    );
    setSelectedEdgeId(null);
    setConnectionCheck(null);
    setLastLoadedGraphFingerprint(runtimeGraphFingerprint(nextGraph.id, nextGraph.revision));
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
      setGraph(normalizedGraph);
      setSelectedNodeId(normalizedGraph.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      setPositions({});
      clearPendingPatch();
      setImportError(null);
      setConnectionCheck(null);
      setRuntimeResult(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Graph import failed.");
    }
  }

  function exportGraph() {
    const blob = new Blob([`${JSON.stringify(graph, null, 2)}\n`], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${graph.id || "skenion-graph"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function resetSample() {
    setGraph(sampleGraph);
    setPositions({});
    setSelectedNodeId(sampleGraph.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    clearPendingPatch();
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadRenderSample() {
    setGraph(renderSampleGraph);
    setPositions({});
    setSelectedNodeId(renderSampleGraph.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    clearPendingPatch();
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadShaderUniformSample() {
    setGraph(shaderUniformSampleGraph);
    setPositions(shaderUniformSamplePositions);
    setSelectedNodeId(shaderUniformSampleGraph.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    clearPendingPatch();
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadShaderMultiUniformSample() {
    setGraph(shaderMultiUniformSampleGraph);
    setPositions(shaderMultiUniformSamplePositions);
    setSelectedNodeId(shaderMultiUniformSampleGraph.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    clearPendingPatch();
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function loadPortDemoSample() {
    setGraph(portDemoSampleGraph);
    setPositions(portDemoSamplePositions);
    setSelectedNodeId(portDemoSampleGraph.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    clearPendingPatch();
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function removeNode(node: GraphNodeV01) {
    const patch = { type: "removeNode", nodeId: node.id } satisfies GraphPatch;
    setGraph((currentGraph) => applyPatch(currentGraph, patch));
    recordGraphPatches([patch]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setRuntimeResult(null);
  }

  function setNodeParam(nodeId: string, key: string, value: unknown) {
    const patch = { type: "setNodeParam", nodeId, key, value } satisfies GraphPatch;
    setGraph((currentGraph) => applyPatch(currentGraph, patch));
    recordGraphPatches([patch]);
    setConnectionCheck(null);
    setRuntimeResult(null);
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
      const session = await client.getSession();
      const history = runtimeSupportsHistory(info) ? await client.getSessionHistory() : null;
      const previewStatus = runtimeSupportsPreview(info) ? await client.getPreviewStatus() : null;
      const telemetry = runtimeSupportsTelemetry(info) ? await client.getTelemetry() : null;
      setRuntimeInfo(info);
      setRuntimeSession(session);
      setRuntimeHistory(history);
      setRuntimePreviewStatus(previewStatus);
      setRuntimeTelemetry(telemetry);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeInfo(null);
      setRuntimeSession(null);
      setRuntimeHistory(null);
      setRuntimePreviewStatus(null);
      setRuntimeTelemetry(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime connection failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function runRuntimeAction(
    kind: RuntimeResultKind,
    action: () => Promise<RuntimeApiResponse>
  ) {
    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    try {
      const response = await action();
      setRuntimeResult({
        kind,
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
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
      if (kind === "loadSession") {
        setLastLoadedGraphFingerprint((current) =>
          nextLoadedGraphFingerprint(current, response, currentGraphFingerprint)
        );
        if (response.ok && response.loaded) {
          clearPendingPatch();
        }
      }
      if (kind === "clearSession" && response.ok) {
        setLastLoadedGraphFingerprint(null);
        clearPendingPatch();
      }
      if ((kind === "session" || kind === "loadSession" || kind === "clearSession") && runtimeSupportsHistory(runtimeInfo)) {
        await refreshRuntimeHistory(client);
      }
      if (kind === "session" || kind === "loadSession" || kind === "clearSession") {
        await refreshRuntimePreview(client);
      }
      await refreshRuntimeTelemetry(client);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function applyPendingPatch() {
    if (!pendingPatchBaseRevision || pendingPatchOps.length === 0) {
      return;
    }

    setRuntimeBusyAction("applyPatch");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const patch = createGraphPatch(pendingPatchBaseRevision, pendingPatchOps, {
        id: `patch_${Date.now()}`,
        clientId: "studio-local"
      });
      const response: RuntimePatchResponse = await createRuntimeClient({
        baseUrl: runtimeUrl
      }).applySessionPatch(patch);
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      setRuntimeSession(response.session);
      setRuntimeHistory(response.history);
      await refreshRuntimePreview(client);
      await refreshRuntimeTelemetry(client);
      setRuntimeResult({
        kind: "applyPatch",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      if (response.ok && response.applied && response.graph) {
        acceptRuntimeGraph(response.graph);
        clearPendingPatch();
      } else if (response.conflict) {
        setPatchConflict(response.diagnostics[0]?.message ?? "Runtime rejected patch because the session graph revision changed.");
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
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
    if (runtimeStatus !== "connected" || !runtimeSession?.loaded || !runtimeSupportsControl(runtimeInfo)) {
      return;
    }

    setRuntimeBusyAction("controlEvent");
    setRuntimeError(null);
    try {
      const client = createRuntimeClient({ baseUrl: runtimeUrl });
      const response = await client.sendControlEvent(request);
      setRuntimeResult({
        kind: "controlEvent",
        response,
        receivedAt: new Date().toISOString()
      });
      setRuntimeStatus("connected");
      const session = await client.getSession();
      setRuntimeSession(session);
      if (runtimeSupportsHistory(runtimeInfo)) {
        await refreshRuntimeHistory(client);
      }
      await refreshRuntimePreview(client);
      await refreshRuntimeTelemetry(client);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function runtimeSupportsHistory(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.history") ?? false;
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
      aside={{ width: 356, breakpoint: "md" }}
      padding={0}
    >
      <AppShell.Header>
        <StudioToolbar
          graph={graph}
          summary={graphSummary(graph)}
          validation={validation}
          onExport={exportGraph}
          onImport={importGraph}
          onLoadPortDemoSample={loadPortDemoSample}
          onLoadRenderSample={loadRenderSample}
          onLoadShaderMultiUniformSample={loadShaderMultiUniformSample}
          onLoadShaderUniformSample={loadShaderUniformSample}
          onReset={resetSample}
        />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <PalettePanel registry={nodeRegistry} onAddNode={addNode} />
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
          <GraphCanvas
            graph={graph}
            positions={positions}
            onConnectionCheck={setConnectionCheck}
            onGraphChange={updateGraph}
            onPositionsChange={setPositions}
            onSelectedEdgeChange={setSelectedEdgeId}
            onSelectedNodeChange={setSelectedNodeId}
            selectedEdgeId={selectedEdgeId}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </AppShell.Main>

      <AppShell.Aside p="md">
        <ScrollArea className="aside-scroll" offsetScrollbars>
          <Stack gap="md">
            <RuntimePanel
              busyAction={runtimeBusyAction}
              error={runtimeError}
              frames={runtimeFrames}
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
              onFramesChange={setRuntimeFrames}
              onLoadSession={() =>
                runRuntimeSessionAction("loadSession", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).loadSession(runtimeProject)
                )
              }
              onPlan={() =>
                runRuntimeAction("plan", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).buildPlan(runtimeProject)
                )
              }
              onPlanSession={() =>
                runRuntimeSessionAction("planSession", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).planSession()
                )
              }
              onRefreshSession={() =>
                runRuntimeSessionAction("session", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).getSession()
                )
              }
              onRun={() =>
                runRuntimeAction("run", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).runProject(runtimeProject, runtimeFrames)
                )
              }
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
              patchBaseRevision={pendingPatchBaseRevision}
              patchConflict={patchConflict}
              pendingPatchOps={pendingPatchOps.length}
              onApplyPendingPatch={applyPendingPatch}
              onClearPendingPatch={clearPendingPatch}
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
              onValidate={() =>
                runRuntimeAction("validate", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).validateProject(runtimeProject)
                )
              }
              onValidateSession={() =>
                runRuntimeSessionAction("validateSession", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).validateSession()
                )
              }
            />
            <InspectorPanel
              connectionCheck={connectionCheck}
              graph={graph}
              edge={selectedEdge}
              node={selectedNode}
              onRemoveNode={removeNode}
              onSendRuntimeControl={(request) => {
                void sendRuntimeControlEvent(request);
              }}
              onSetNodeParam={setNodeParam}
              runtimeControlBusy={runtimeBusyAction === "controlEvent"}
              runtimeControlEnabled={
                runtimeStatus === "connected" &&
                Boolean(runtimeSession?.loaded) &&
                runtimeSupportsControl(runtimeInfo)
              }
              semanticDiagnostics={semanticDiagnostics}
              validation={validation}
            />
          </Stack>
        </ScrollArea>
      </AppShell.Aside>
    </AppShell>
  );
}
