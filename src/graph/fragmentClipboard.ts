import {
  analyzeGraphFragmentV02,
  validateGraphFragmentV02,
  type CanvasNodeViewV01,
  type EdgeSpecV02,
  type EdgeV01,
  type GraphDocumentV01,
  type GraphFragmentDiagnosticV02,
  type GraphFragmentOmittedEdgeV02,
  type GraphFragmentV02,
  type GraphNodeV01,
  type GraphNodeV02,
  type PortSpecV02,
  type PortV01,
  type ViewStateV01
} from "@skenion/contracts";
import { edgeId } from "./portSemantics";

export const SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE = "application/vnd.skenion.graph-fragment+json";

export interface GraphSelection {
  edgeIds: string[];
  nodeIds: string[];
}

export interface GraphFragmentBuildResult {
  diagnostics: GraphFragmentDiagnosticV02[];
  fragment: GraphFragmentV02 | null;
  omittedEdges: GraphFragmentOmittedEdgeV02[];
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
  graph: GraphDocumentV01,
  viewState: ViewStateV01,
  selection: GraphSelection,
  options: { id?: string; source?: string } = {}
): GraphFragmentBuildResult {
  const nodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const nodes = graph.nodes.filter((node) => nodeIds.has(node.id)).map(graphNodeV01ToFragmentNodeV02);
  const edges: EdgeSpecV02[] = [];
  const omittedEdges: GraphFragmentOmittedEdgeV02[] = [];

  for (const edge of graph.edges) {
    const id = edgeId(edge);
    if (nodeIds.has(edge.from.node) && nodeIds.has(edge.to.node)) {
      edges.push(graphEdgeV01ToFragmentEdgeV02(edge));
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

  const fragment: GraphFragmentV02 = {
    schema: "skenion.graph.fragment",
    schemaVersion: "0.2.0",
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
  const validation = validateGraphFragmentV02(fragment, { outsideEndpointPolicy: "omit" });
  const analysis = analyzeGraphFragmentV02(fragment, { outsideEndpointPolicy: "omit" });

  return {
    diagnostics: validation.ok ? analysis.diagnostics : analysis.diagnostics,
    fragment: validation.ok ? fragment : null,
    omittedEdges
  };
}

export function serializeGraphFragmentClipboard(fragment: GraphFragmentV02): string {
  return JSON.stringify({
    type: SKENION_GRAPH_FRAGMENT_CLIPBOARD_TYPE,
    fragment
  });
}

export function parseGraphFragmentClipboard(text: string): GraphFragmentV02 | null {
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
  const result = validateGraphFragmentV02(candidate, { outsideEndpointPolicy: "omit" });
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

function graphNodeV01ToFragmentNodeV02(node: GraphNodeV01): GraphNodeV02 {
  return {
    id: node.id,
    kind: node.kind,
    kindVersion: node.kindVersion,
    params: clone(node.params),
    ports: node.ports.map(graphPortV01ToPortSpecV02)
  };
}

function graphPortV01ToPortSpecV02(port: PortV01): PortSpecV02 {
  const spec: PortSpecV02 = {
    id: port.id,
    direction: port.direction,
    label: port.label,
    type: portTypeV01ToPortSpecType(port),
    rate: portRateV01ToPortSpecRate(port),
    required: port.required,
    defaultValue: port.default
  };
  if (port.activation === "trigger") {
    spec.triggerMode = "trigger";
  } else if (port.activation === "latched") {
    spec.triggerMode = "latched";
    spec.latch = true;
  }
  return omitUndefined(spec);
}

function graphEdgeV01ToFragmentEdgeV02(edge: EdgeV01): EdgeSpecV02 {
  const extras = edge as EdgeV01 &
    Partial<Omit<EdgeSpecV02, "id" | "source" | "target">> & { id?: string };
  return omitUndefined({
    id: edgeId(edge),
    source: { nodeId: edge.from.node, portId: edge.from.port },
    target: { nodeId: edge.to.node, portId: edge.to.port },
    resolvedType: extras.resolvedType,
    order: extras.order,
    enabled: extras.enabled,
    adapter: extras.adapter,
    feedback: extras.feedback,
    styleOverride: extras.styleOverride,
    label: extras.label,
    description: extras.description
  });
}

function portTypeV01ToPortSpecType(port: PortV01): string {
  return port.type.dataKind;
}

function portRateV01ToPortSpecRate(port: PortV01): PortSpecV02["rate"] {
  switch (port.type.flow) {
    case "event":
      return "event";
    case "signal":
      return "audio";
    case "resource":
      return "resource";
    case "stream":
      return undefined;
    case "value":
      return "control";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
