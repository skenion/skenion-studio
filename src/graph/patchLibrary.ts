import type {
  DataFlow,
  DataTypeV01,
  EdgeSpecV02,
  EdgeV01,
  GraphDocumentV01,
  GraphDocumentV02,
  GraphNodeV01,
  PatchContractPortV02,
  PatchDefinitionV02,
  PortSpecV02,
  PortV01
} from "@skenion/contracts";
import { derivePatchContractV02 } from "@skenion/contracts";

export const PATCH_DEFINITION_SCHEMA_VERSION = "0.2.0" as const;
export const SUBPATCH_NODE_KIND = "core.subpatch" as const;

export type { PatchDefinitionV02 };

export interface PatchLibraryV02 {
  patches: PatchDefinitionV02[];
}

type PortV02DisplayExtras = Pick<
  PortSpecV02,
  | "accepts"
  | "defaultValue"
  | "description"
  | "fanOutPolicy"
  | "group"
  | "latch"
  | "maxConnections"
  | "mergePolicy"
  | "minConnections"
  | "rate"
  | "styleKey"
  | "triggerMode"
>;

export function createPatchLibraryV02(patches: PatchDefinitionV02[] = []): PatchLibraryV02 {
  return { patches };
}

export function isPatchDefinitionV02(value: unknown): value is PatchDefinitionV02 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PatchDefinitionV02>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.revision === "string" &&
    candidate.revision.length > 0 &&
    Boolean(candidate.graph) &&
    candidate.graph?.schema === "skenion.graph" &&
    candidate.graph?.schemaVersion === PATCH_DEFINITION_SCHEMA_VERSION
  );
}

export function findPatchDefinition(
  library: PatchLibraryV02 | undefined,
  patchId: string
): PatchDefinitionV02 | null {
  return library?.patches.find((patch) => patch.id === patchId) ?? null;
}

export function patchDisplayName(definition: PatchDefinitionV02): string {
  return metadataString(definition.metadata?.title) ?? definition.id;
}

export function patchDescription(definition: PatchDefinitionV02): string {
  return metadataString(definition.metadata?.description) ?? "";
}

export function patchTags(definition: PatchDefinitionV02): string[] {
  const tags = definition.metadata?.["tags"];
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

export function patchDefinitionBoundaryPorts(definition: PatchDefinitionV02): PatchContractPortV02[] {
  return derivePatchContractV02(definition).ports;
}

export function createSubpatchNodeFromDefinition(
  definition: PatchDefinitionV02,
  existingNodes: GraphNodeV01[],
  options: { nodeId?: string; objectText?: string } = {}
): GraphNodeV01 {
  const objectText = options.objectText ?? `p ${definition.id}`;
  const description = patchDescription(definition).trim();

  return {
    id: options.nodeId ?? uniqueSubpatchNodeId(definition.id, existingNodes),
    kind: SUBPATCH_NODE_KIND,
    kindVersion: PATCH_DEFINITION_SCHEMA_VERSION,
    params: {
      label: objectText,
      objectText,
      patchId: definition.id,
      patchRevision: definition.revision,
      ...(description ? { description } : {})
    },
    ports: patchDefinitionBoundaryPorts(definition).map(portSpecV02ToGraphPort)
  };
}

function metadataString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function patchDefinitionToDisplayGraph(definition: PatchDefinitionV02): GraphDocumentV01 {
  return graphDocumentV02ToDisplayGraph(definition.graph);
}

export function graphDocumentV01ToGraphDocumentV02(graph: GraphDocumentV01): GraphDocumentV02 {
  return {
    schema: "skenion.graph",
    schemaVersion: PATCH_DEFINITION_SCHEMA_VERSION,
    id: graph.id,
    revision: graph.revision,
    nodes: graph.nodes.map(graphNodeToGraphNodeV02),
    edges: graph.edges.map(graphEdgeToEdgeSpecV02)
  };
}

export function graphNodeToGraphNodeV02(node: GraphNodeV01): GraphDocumentV02["nodes"][number] {
  return {
    id: node.id,
    kind: node.kind,
    kindVersion: node.kindVersion,
    params: { ...node.params },
    ports: node.ports.map(graphPortToPortSpecV02),
    ...("portGroups" in node && Array.isArray(node.portGroups)
      ? {
          portGroups: node.portGroups.map((group) => ({ ...group } as GraphNodeV02PortGroup))
        }
      : {})
  };
}

export function graphDocumentV02ToDisplayGraph(graph: GraphDocumentV02): GraphDocumentV01 {
  return {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: graph.id,
    revision: graph.revision,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      kindVersion: node.kindVersion,
      params: { ...node.params },
      ports: node.ports.map(portSpecV02ToGraphPort),
      ...(node.portGroups ? { portGroups: node.portGroups.map((group) => ({ ...group })) } : {})
    }) as GraphNodeV01),
    edges: graph.edges.map(edgeSpecV02ToGraphEdge)
  };
}

export function portSpecV02ToGraphPort(port: PortSpecV02): PortV01 {
  const graphPort: PortV01 & PortV02DisplayExtras = {
    id: port.id,
    direction: port.direction,
    label: port.label ?? labelForPatchPort(port.id),
    type: dataTypeFromPortSpecV02(port),
    required: port.required ?? ((port.minConnections ?? 0) > 0),
    rate: port.rate,
    accepts: port.accepts ? [...port.accepts] : undefined,
    minConnections: port.minConnections,
    maxConnections: port.maxConnections,
    mergePolicy: port.mergePolicy,
    fanOutPolicy: port.fanOutPolicy,
    triggerMode: port.triggerMode,
    defaultValue: port.defaultValue,
    latch: port.latch,
    styleKey: port.styleKey,
    group: port.group,
    description: port.description
  };

  const activation = activationForPortSpec(port);
  if (port.direction === "input" && activation) {
    graphPort.activation = activation;
  }
  if (Object.hasOwn(port, "defaultValue")) {
    graphPort.default = port.defaultValue;
  }

  return omitUndefined(graphPort);
}

export function graphPortToPortSpecV02(port: PortV01): PortSpecV02 {
  const extras = port as PortV01 & PortV02DisplayExtras;
  const portSpec: PortSpecV02 = {
    id: port.id,
    direction: port.direction,
    type: portSpecTypeFromGraphPort(port),
    label: port.label,
    rate: extras.rate ?? portRateFromGraphPort(port),
    accepts: extras.accepts ? [...extras.accepts] : undefined,
    minConnections: extras.minConnections,
    maxConnections: extras.maxConnections,
    mergePolicy: extras.mergePolicy,
    fanOutPolicy: extras.fanOutPolicy,
    triggerMode: extras.triggerMode ?? triggerModeFromGraphPort(port),
    defaultValue: Object.hasOwn(port, "default") ? port.default : extras.defaultValue,
    latch: extras.latch ?? (port.activation === "latched" ? true : undefined),
    required: port.required,
    styleKey: extras.styleKey,
    group: extras.group,
    description: extras.description
  };

  return omitUndefined(portSpec);
}

export function dataTypeFromPortSpecV02(port: PortSpecV02): DataTypeV01 {
  const type = normalizedPortSpecType(port.type);
  const graphType: DataTypeV01 = {
    flow: flowForPortSpecType(type, port.rate),
    dataKind: dataKindForPortSpecType(type)
  };

  const format = defaultFormatForDataKind(graphType.dataKind);
  if (format) {
    graphType.format = format;
  }

  return graphType;
}

function edgeSpecV02ToGraphEdge(edge: EdgeSpecV02): EdgeV01 {
  return omitUndefined({
    from: {
      node: edge.source.nodeId,
      port: edge.source.portId
    },
    to: {
      node: edge.target.nodeId,
      port: edge.target.portId
    },
    id: edge.id,
    resolvedType: edge.resolvedType,
    order: edge.order,
    enabled: edge.enabled,
    adapter: edge.adapter,
    feedback: edge.feedback ? { ...edge.feedback } : undefined,
    styleOverride: edge.styleOverride,
    label: edge.label,
    description: edge.description
  }) as EdgeV01;
}

export function graphEdgeToEdgeSpecV02(edge: EdgeV01): EdgeSpecV02 {
  const extras = edge as EdgeV01 & Partial<Omit<EdgeSpecV02, "id" | "source" | "target">> & { id?: string };
  return omitUndefined({
    id: extras.id ?? displayEdgeId(edge),
    source: {
      nodeId: edge.from.node,
      portId: edge.from.port
    },
    target: {
      nodeId: edge.to.node,
      portId: edge.to.port
    },
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

function activationForPortSpec(port: PortSpecV02): PortV01["activation"] | undefined {
  if (port.triggerMode === "trigger" || port.triggerMode === "latched") {
    return port.triggerMode;
  }
  if (port.latch) {
    return "latched";
  }
  return undefined;
}

function triggerModeFromGraphPort(port: PortV01): PortSpecV02["triggerMode"] | undefined {
  if (port.activation === "trigger" || port.activation === "latched") {
    return port.activation;
  }
  return undefined;
}

function normalizedPortSpecType(type: string): string {
  return type.trim();
}

function portSpecTypeFromGraphPort(port: PortV01): string {
  const dataKind = port.type.dataKind;
  if (port.type.flow === "resource" && dataKind === "asset.video") {
    return "asset.video";
  }
  if (port.type.flow === "resource" && dataKind !== "gpu.texture2d" && dataKind !== "render.frame") {
    return `resource.${dataKind}`;
  }
  if (port.type.flow === "stream" && !dataKind.startsWith("stream.")) {
    return `stream.${dataKind}`;
  }
  if (port.type.flow === "value" && isGenericValueDataKind(dataKind)) {
    return `value.${dataKind}`;
  }
  return dataKind;
}

function isGenericValueDataKind(dataKind: string): boolean {
  return ![
    "boolean",
    "color",
    "event.bang",
    "message.any",
    "number.float",
    "number.int",
    "number.uint",
    "string"
  ].includes(dataKind);
}

function portRateFromGraphPort(port: PortV01): PortSpecV02["rate"] | undefined {
  switch (port.type.flow) {
    case "event":
      return "event";
    case "signal":
      return "audio";
    case "resource":
      return port.type.dataKind === "gpu.texture2d"
        ? "gpu"
        : port.type.dataKind === "render.frame"
          ? "render"
          : "resource";
    case "stream":
      return undefined;
    case "value":
      return "control";
  }
}

function flowForPortSpecType(type: string, rate: PortSpecV02["rate"]): DataFlow {
  if (type === "event.bang" || type === "message.any" || rate === "event") {
    return "event";
  }
  if (type === "signal.audio" || rate === "audio") {
    return "signal";
  }
  if (type === "video.frame" || type.startsWith("stream.")) {
    return "stream";
  }
  if (
    type === "asset.video" ||
    type === "gpu.texture2d" ||
    type === "render.frame" ||
    type.startsWith("resource.") ||
    rate === "gpu" ||
    rate === "render" ||
    rate === "resource"
  ) {
    return "resource";
  }
  return "value";
}

function dataKindForPortSpecType(type: string): string {
  if (type === "render.frame") {
    return "render.frame";
  }
  if (type.startsWith("value.")) {
    return type.slice("value.".length);
  }
  if (type.startsWith("stream.")) {
    return type.slice("stream.".length);
  }
  if (type.startsWith("resource.")) {
    return type.slice("resource.".length);
  }
  return type;
}

function defaultFormatForDataKind(dataKind: string): string | undefined {
  if (dataKind === "number.float") {
    return "f32";
  }
  if (dataKind === "number.int") {
    return "i32";
  }
  if (dataKind === "number.uint") {
    return "u32";
  }
  if (dataKind === "color") {
    return "rgba32f";
  }
  return undefined;
}

function uniqueSubpatchNodeId(patchId: string, existingNodes: GraphNodeV01[]): string {
  const baseId = slugForNodeId(patchId) || "subpatch";
  let index = existingNodes.length + 1;
  let id = `${baseId}_${index}`;
  const existingIds = new Set(existingNodes.map((node) => node.id));

  while (existingIds.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }

  return id;
}

function slugForNodeId(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function labelForPatchPort(id: string): string {
  return id
    .split(/[-_]/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function displayEdgeId(edge: EdgeV01): string {
  return `edge_${edge.from.node}_${edge.from.port}_${edge.to.node}_${edge.to.port}`;
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}

type GraphNodeV02PortGroup = NonNullable<GraphDocumentV02["nodes"][number]["portGroups"]>[number];
