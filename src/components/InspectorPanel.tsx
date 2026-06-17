import { Divider, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import type { GraphDocumentV01, GraphNodeV01, ShaderDiagnosticV01, ValidationResult } from "@skenion/contracts";
import { ConnectionDiagnosticsPanel } from "./inspector/ConnectionDiagnosticsPanel";
import { EdgeInspector } from "./inspector/EdgeInspector";
import { FeedbackPolicyDialog } from "./inspector/FeedbackPolicyDialog";
import { GraphDiagnosticsPanel } from "./inspector/GraphDiagnosticsPanel";
import { InspectorShell } from "./inspector/InspectorShell";
import { NodeInspector } from "./inspector/NodeInspector";
import { NodeHelp } from "./inspector/NodeHelp";
import type {
  EdgeInspectorModel,
  GraphSemanticDiagnostic
} from "../graph/portSemantics";
import type { ConnectionCheck } from "../graph/skenionGraph";
import type { RuntimeControlEventRequest, RuntimeGeneratedShaderResponse } from "../runtime/types";

interface InspectorPanelProps {
  connectionCheck: ConnectionCheck | null;
  edge: EdgeInspectorModel | null;
  graph: GraphDocumentV01;
  node: GraphNodeV01 | null;
  helpNodeId: string | null;
  semanticDiagnostics: GraphSemanticDiagnostic[];
  validation: ValidationResult<GraphDocumentV01>;
  generatedShader: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy: boolean;
  runtimeShaderDiagnostics: ShaderDiagnosticV01[];
  onLoadGeneratedShader?: () => void;
  onOpenHelpGraph?: (nodeKind: string) => void;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
  runtimeControlBusy: boolean;
  runtimeControlEnabled: boolean;
}

export function InspectorPanel({
  connectionCheck,
  edge,
  graph,
  generatedShader,
  generatedShaderBusy,
  helpNodeId,
  node,
  onLoadGeneratedShader,
  onOpenHelpGraph,
  onRemoveNode,
  onSendRuntimeControl,
  onSetNodeParam,
  onSyncShaderInputs,
  runtimeControlBusy,
  runtimeControlEnabled,
  runtimeShaderDiagnostics,
  semanticDiagnostics,
  validation
}: InspectorPanelProps) {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const selectedEdgeDiagnostics = edge
    ? semanticDiagnostics.filter((diagnostic) => diagnostic.edgeId === edge.id)
    : [];
  const paletteHelp = helpNodeId ? getBuiltinNodeHelp(helpNodeId) : undefined;
  const paletteHelpGraph = helpNodeId ? getBuiltinNodeHelpGraph(helpNodeId) : undefined;

  return (
    <InspectorShell edgeCount={graph.edges.length} nodeCount={graph.nodes.length}>
      <FeedbackPolicyDialog
        edge={edge}
        onClose={() => setFeedbackDialogOpen(false)}
        opened={feedbackDialogOpen}
      />
      <Stack gap="md">
        <GraphDiagnosticsPanel semanticDiagnostics={semanticDiagnostics} validation={validation} />
        <ConnectionDiagnosticsPanel connectionCheck={connectionCheck} />
        <Divider />

        {edge ? (
          <EdgeInspector
            diagnostics={selectedEdgeDiagnostics}
            edge={edge}
            onOpenFeedbackDialog={() => setFeedbackDialogOpen(true)}
          />
        ) : node ? (
          <NodeInspector
            generatedShader={generatedShader}
            generatedShaderBusy={generatedShaderBusy}
            node={node}
            onLoadGeneratedShader={onLoadGeneratedShader}
            onOpenHelpGraph={onOpenHelpGraph}
            onRemoveNode={onRemoveNode}
            onSendRuntimeControl={onSendRuntimeControl}
            onSetNodeParam={onSetNodeParam}
            onSyncShaderInputs={onSyncShaderInputs}
            runtimeControlBusy={runtimeControlBusy}
            runtimeControlEnabled={runtimeControlEnabled}
            runtimeShaderDiagnostics={runtimeShaderDiagnostics}
          />
        ) : paletteHelp ? (
          <NodeHelp
            help={paletteHelp}
            helpGraph={paletteHelpGraph}
            onOpenAsNewGraph={
              paletteHelpGraph && onOpenHelpGraph ? () => onOpenHelpGraph(paletteHelp.id) : undefined
            }
          />
        ) : (
          <Text c="dimmed" size="sm">
            Select a node or edge on the canvas, or choose Help from the palette.
          </Text>
        )}
      </Stack>
    </InspectorShell>
  );
}
