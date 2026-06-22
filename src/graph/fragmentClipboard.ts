import {
  analyzeGraphFragmentV01,
  validateGraphFragmentV01,
  type CanvasNodeViewV01,
  type EdgeSpecV01,
  type GraphFragmentDiagnosticV01,
  type GraphFragmentOmittedEdgeV01,
  type GraphFragmentV01,
  type ViewStateV01
} from "@skenion/contracts";
import {
  CURRENT_CONTRACT_SCHEMA_VERSION,
  displayEdgeToEdgeSpec,
  displayNodeToContractNode,
  type DisplayGraphDocumentV01
} from "./patchLibrary";
import { edgeId } from "./portSemantics";

export const SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE = "application/vnd.skenion.graph-fragment+json";

export interface GraphSelection {
  edgeIds: string[];
  nodeIds: string[];
}

export interface GraphFragmentBuildResult {
  diagnostics: GraphFragmentDiagnosticV01[];
  fragment: GraphFragmentV01 | null;
  omittedEdges: GraphFragmentOmittedEdgeV01[];
}

export interface GraphClipboardShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

export type GraphClipboardShortcutAction = "copy" | "paste";

export interface GraphFragmentPasteAvailabilityInput {
  capabilities: string[] | null | undefined;
  connected: boolean;
  sessionLoaded: boolean;
  sessionSynced: boolean;
}

export function graphFragmentPasteAvailability(
  input: GraphFragmentPasteAvailabilityInput
): { ok: true } | { ok: false; reason: string } {
  if (!input.connected) {
    return { ok: false, reason: "Connect Runtime before pasting graph fragments." };
  }
  if (!input.sessionLoaded || !input.sessionSynced) {
    return { ok: false, reason: "Load and sync a Runtime session before pasting graph fragments." };
  }
  if (!input.capabilities?.includes("session.operation")) {
    return { ok: false, reason: "Runtime does not support session.operation graph fragment paste." };
  }
  return { ok: true };
}

export function graphClipboardShortcutAction(
  event: GraphClipboardShortcutEvent
): GraphClipboardShortcutAction | null {
  if (isEditableShortcutTarget(event.target) || event.altKey || event.shiftKey) {
    return null;
  }

  const primaryModifier = event.metaKey || event.ctrlKey;
  if (!primaryModifier) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === "c") {
    return "copy";
  }
  if (key === "v") {
    return "paste";
  }
  return null;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "select" || tagName === "textarea";
}

export function createGraphFragmentFromSelection(
  graph: DisplayGraphDocumentV01,
  viewState: ViewStateV01,
  selection: GraphSelection,
  options: { id?: string; source?: string } = {}
): GraphFragmentBuildResult {
  const nodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id)).map(displayNodeToContractNode);
  const edges: EdgeSpecV01[] = [];
  const omittedEdges: GraphFragmentOmittedEdgeV01[] = [];

  for (const edge of graph.edges) {
    const id = edgeId(edge);
    if (nodeIds.has(edge.from.node) && nodeIds.has(edge.to.node)) {
      edges.push(displayEdgeToEdgeSpec(edge));
      continue;
    }
    if (selectedEdgeIds.has(id)) {
      omittedEdges.push({
        id,
        source: { nodeId: edge.from.node, portId: edge.from.port },
        target: { nodeId: edge.to.node, portId: edge.to.port },
        reason: "outside-fragment"
      });
    }
  }

  if (nodes.length === 0) {
    return {
      diagnostics: [
        {
          severity: "warning",
          code: "empty-selection",
          message: "Select one or more graph nodes before copying a fragment."
        }
      ],
      fragment: null,
      omittedEdges
    };
  }

  const fragment: GraphFragmentV01 = {
    schema: "skenion.graph.fragment",
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    id: options.id,
    nodes,
    edges,
    view: {
      nodes: fragmentNodeViews(viewState, selection.nodeIds)
    },
    omittedEdges,
    metadata: {
      ...(options.source ? { source: options.source } : {}),
      copiedAt: new Date().toISOString()
    }
  };
  const validation = validateGraphFragmentV01(fragment, { outsideEndpointPolicy: "omit" });
  const analysis = analyzeGraphFragmentV01(fragment, { outsideEndpointPolicy: "omit" });

  return {
    diagnostics: validation.ok ? analysis.diagnostics : analysis.diagnostics,
    fragment: validation.ok ? fragment : null,
    omittedEdges
  };
}

export function serializeGraphFragmentClipboard(fragment: GraphFragmentV01): string {
  return JSON.stringify({
    type: SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE,
    fragment
  });
}

export function parseGraphFragmentClipboard(text: string): GraphFragmentV01 | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  const candidate =
    isRecord(value) && value.type === SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE
      ? value.fragment
      : value;
  const result = validateGraphFragmentV01(candidate, { outsideEndpointPolicy: "omit" });
  return result.ok ? result.value : null;
}

function fragmentNodeViews(
  viewState: ViewStateV01,
  nodeIds: string[]
): Record<string, CanvasNodeViewV01> {
  return Object.fromEntries(
    nodeIds.flatMap((nodeId) => {
      const view = viewState.canvas.nodes[nodeId];
      return view ? [[nodeId, clone(view)]] : [];
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
