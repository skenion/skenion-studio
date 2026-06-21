import { Stack, Text } from "@mantine/core";
import { useState } from "react";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import type { GraphDocumentV01, GraphFragmentV02, GraphNodeV01, ShaderDiagnosticV01 } from "@skenion/contracts";
import { ConnectionDiagnosticsPanel } from "./inspector/ConnectionDiagnosticsPanel";
import { EdgeInspector } from "./inspector/EdgeInspector";
import { FeedbackPolicyDialog } from "./inspector/FeedbackPolicyDialog";
import { InspectorShell } from "./inspector/InspectorShell";
import { NodeInspector } from "./inspector/NodeInspector";
import { NodeHelp } from "./inspector/NodeHelp";
import type {
  EdgeInspectorModel,
  GraphSemanticDiagnostic
} from "../graph/portSemantics";
import type { ConnectionCheck } from "../graph/skenionGraph";
import type { GraphFragmentBuildResult } from "../graph/fragmentClipboard";
import type { RuntimeGeneratedShaderResponse } from "../runtime/types";

interface InspectorPanelProps {
  connectionCheck: ConnectionCheck | null;
  edge: EdgeInspectorModel | null;
  graphLocked: boolean;
  graph: GraphDocumentV01;
  node: GraphNodeV01 | null;
  helpNodeId: string | null;
  semanticDiagnostics: GraphSemanticDiagnostic[];
  generatedShader: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy: boolean;
  runtimeAssetImportBusy: boolean;
  runtimeAssetImportEnabled: boolean;
  runtimeShaderDiagnostics: ShaderDiagnosticV01[];
  onImportAsset?: (node: GraphNodeV01, file: File) => Promise<void>;
  onHelpClipboardWriteError?: (message: string) => void;
  onHelpCopyFragment?: (fragment: GraphFragmentV02, result: GraphFragmentBuildResult) => void;
  onHelpCopyFragmentError?: (message: string) => void;
  onLoadGeneratedShader?: () => void;
  onOpenHelpGraph?: (nodeKind: string) => void;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
}

export function InspectorPanel({
  connectionCheck,
  edge,
  graph,
  graphLocked,
  generatedShader,
  generatedShaderBusy,
  helpNodeId,
  node,
  onImportAsset,
  onHelpClipboardWriteError,
  onHelpCopyFragment,
  onHelpCopyFragmentError,
  onLoadGeneratedShader,
  onOpenHelpGraph,
  onRemoveNode,
  onSetNodeParam,
  onSyncShaderInputs,
  runtimeAssetImportBusy,
  runtimeAssetImportEnabled,
  runtimeShaderDiagnostics,
  semanticDiagnostics
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
        <ConnectionDiagnosticsPanel connectionCheck={connectionCheck} />

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
            graphLocked={graphLocked}
            onLoadGeneratedShader={onLoadGeneratedShader}
            onImportAsset={onImportAsset}
            onHelpClipboardWriteError={onHelpClipboardWriteError}
            onHelpCopyFragment={onHelpCopyFragment}
            onHelpCopyFragmentError={onHelpCopyFragmentError}
            onOpenHelpGraph={onOpenHelpGraph}
            onRemoveNode={onRemoveNode}
            onSetNodeParam={onSetNodeParam}
            onSyncShaderInputs={onSyncShaderInputs}
            runtimeAssetImportBusy={runtimeAssetImportBusy}
            runtimeAssetImportEnabled={runtimeAssetImportEnabled}
            runtimeShaderDiagnostics={runtimeShaderDiagnostics}
          />
        ) : paletteHelp ? (
          <NodeHelp
            help={paletteHelp}
            helpGraph={paletteHelpGraph}
            onClipboardWriteError={onHelpClipboardWriteError}
            onCopyFragment={onHelpCopyFragment}
            onCopyFragmentError={onHelpCopyFragmentError}
            onOpenAsEditableCopy={
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
