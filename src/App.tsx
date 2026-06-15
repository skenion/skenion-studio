import { useMemo, useState } from "react";
import { Alert, AppShell, Group, Text } from "@mantine/core";
import { CircleAlert } from "lucide-react";
import type { GraphDocumentV01, GraphNodeV01 } from "@skenion/contracts";
import { GraphCanvas } from "./components/GraphCanvas";
import { InspectorPanel } from "./components/InspectorPanel";
import { PalettePanel } from "./components/PalettePanel";
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

export default function App() {
  const [graph, setGraph] = useState<GraphDocumentV01>(sampleGraph);
  const [positions, setPositions] = useState<ViewPositions>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("value_1");
  const [connectionCheck, setConnectionCheck] = useState<ConnectionCheck | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const validation = useMemo(() => validateGraph(graph), [graph]);
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
  }

  function updateGraph(nextGraph: GraphDocumentV01) {
    setGraph(nextGraph);
    setConnectionCheck(null);
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
  }

  function removeNode(node: GraphNodeV01) {
    setGraph((currentGraph) => applyPatch(currentGraph, { type: "removeNode", nodeId: node.id }));
    setSelectedNodeId(null);
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
        <InspectorPanel
          connectionCheck={connectionCheck}
          graph={graph}
          node={selectedNode}
          onRemoveNode={removeNode}
          validation={validation}
        />
      </AppShell.Aside>
    </AppShell>
  );
}
