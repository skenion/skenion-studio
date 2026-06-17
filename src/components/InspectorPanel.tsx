import { Divider, Stack, Text } from "@mantine/core";
import { useState } from "react";
import type { GraphDocumentV01, GraphNodeV01, ValidationResult } from "@skenion/contracts";
import { ConnectionDiagnosticsPanel } from "./inspector/ConnectionDiagnosticsPanel";
import { EdgeInspector } from "./inspector/EdgeInspector";
import { FeedbackPolicyDialog } from "./inspector/FeedbackPolicyDialog";
import { GraphDiagnosticsPanel } from "./inspector/GraphDiagnosticsPanel";
import { InspectorShell } from "./inspector/InspectorShell";
import { NodeInspector } from "./inspector/NodeInspector";
import type {
  EdgeInspectorModel,
  GraphSemanticDiagnostic
} from "../graph/portSemantics";
import type { ConnectionCheck } from "../graph/skenionGraph";
import type { RuntimeControlEventRequest } from "../runtime/types";

interface InspectorPanelProps {
  connectionCheck: ConnectionCheck | null;
  edge: EdgeInspectorModel | null;
  graph: GraphDocumentV01;
  node: GraphNodeV01 | null;
  semanticDiagnostics: GraphSemanticDiagnostic[];
  validation: ValidationResult<GraphDocumentV01>;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  runtimeControlBusy: boolean;
  runtimeControlEnabled: boolean;
}

export function InspectorPanel({
  connectionCheck,
  edge,
  graph,
  node,
  onRemoveNode,
  onSendRuntimeControl,
  onSetNodeParam,
  runtimeControlBusy,
  runtimeControlEnabled,
  semanticDiagnostics,
  validation
}: InspectorPanelProps) {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const selectedEdgeDiagnostics = edge
    ? semanticDiagnostics.filter((diagnostic) => diagnostic.edgeId === edge.id)
    : [];

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
            node={node}
            onRemoveNode={onRemoveNode}
            onSendRuntimeControl={onSendRuntimeControl}
            onSetNodeParam={onSetNodeParam}
            runtimeControlBusy={runtimeControlBusy}
            runtimeControlEnabled={runtimeControlEnabled}
          />
        ) : (
          <Text c="dimmed" size="sm">
            Select a node or edge on the canvas.
          </Text>
        )}
      </Stack>
    </InspectorShell>
  );
}
