import { useMemo, useState } from "react";
import { Alert, AppShell, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { CircleAlert } from "lucide-react";
import type { GraphDocumentV01, GraphNodeV01 } from "@skenion/contracts";
import { GraphCanvas } from "./components/GraphCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { PalettePanel } from "./components/PalettePanel";
import { RuntimePanel } from "./components/RuntimePanel";
import { StudioToolbar } from "./components/StudioToolbar";
import { nodeRegistry } from "./data/registry";
import { sampleGraph } from "./data/sampleGraph";
import {
  applyPatch,
  createGraphNodeFromDefinition,
  graphSummary,
  validateGraph,
  type ConnectionCheck,
  type ViewPositions
} from "./graph/skenionGraph";
import { createRuntimeClient, DEFAULT_RUNTIME_URL, RuntimeClientError } from "./runtime/client";
import { createRuntimeProjectPayload } from "./runtime/payload";
import type {
  RuntimeActionResult,
  RuntimeApiResponse,
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimeResultKind
} from "./runtime/types";

export default function App() {
  const [graph, setGraph] = useState<GraphDocumentV01>(sampleGraph);
  const [positions, setPositions] = useState<ViewPositions>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("value_1");
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheck | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [runtimeUrl, setRuntimeUrl] = useState(DEFAULT_RUNTIME_URL);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeConnectionStatus>("disconnected");
  const [runtimeBusyAction, setRuntimeBusyAction] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeFrames, setRuntimeFrames] = useState(2);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [runtimeResult, setRuntimeResult] = useState<RuntimeActionResult | null>(null);
  const validation = useMemo(() => validateGraph(graph), [graph]);
  const runtimeProject = useMemo(() => createRuntimeProjectPayload(graph, nodeRegistry), [graph]);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );

  function addNode(definitionId: string) {
    const definition = nodeRegistry.find((candidate) => candidate.id === definitionId);
    if (!definition) {
      return;
    }

    const node = createGraphNodeFromDefinition(definition, graph.nodes);
    setGraph((currentGraph) => applyPatch(currentGraph, { type: "addNode", node }));
    setPositions((currentPositions) => ({
      ...currentPositions,
      [node.id]: {
        x: 88 + (graph.nodes.length % 2) * 300,
        y: 88 + Math.floor(graph.nodes.length / 2) * 180
      }
    }));
    setSelectedNodeId(node.id);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function updateGraph(nextGraph: GraphDocumentV01) {
    setGraph(nextGraph);
    setConnectionCheck(null);
    setRuntimeResult(null);
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

      setGraph(result.value);
      setSelectedNodeId(result.value.nodes[0]?.id ?? null);
      setPositions({});
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
    setImportError(null);
    setConnectionCheck(null);
    setRuntimeResult(null);
  }

  function removeNode(node: GraphNodeV01) {
    setGraph((currentGraph) => applyPatch(currentGraph, { type: "removeNode", nodeId: node.id }));
    setSelectedNodeId(null);
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
      setRuntimeInfo(info);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeInfo(null);
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
            onSelectedNodeChange={setSelectedNodeId}
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
              status={runtimeStatus}
              url={runtimeUrl}
              onConnect={connectRuntime}
              onFramesChange={setRuntimeFrames}
              onPlan={() =>
                runRuntimeAction("plan", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).buildPlan(runtimeProject)
                )
              }
              onRun={() =>
                runRuntimeAction("run", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).runProject(runtimeProject, runtimeFrames)
                )
              }
              onUrlChange={(nextUrl) => {
                setRuntimeUrl(nextUrl);
                setRuntimeStatus("disconnected");
                setRuntimeInfo(null);
                setRuntimeResult(null);
                setRuntimeError(null);
              }}
              onValidate={() =>
                runRuntimeAction("validate", () =>
                  createRuntimeClient({ baseUrl: runtimeUrl }).validateProject(runtimeProject)
                )
              }
            />
            <InspectorPanel
              connectionCheck={connectionCheck}
              graph={graph}
              node={selectedNode}
              onRemoveNode={removeNode}
              validation={validation}
            />
          </Stack>
        </ScrollArea>
      </AppShell.Aside>
    </AppShell>
  );
}
