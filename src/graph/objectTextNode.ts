import { parseObjectTextV01 } from "@skenion/contracts";
import type {
  DataFlow,
  DataTypeV01,
  GraphNodeV01,
  NodeDefinitionManifestV01,
  ObjectTextAtomV01,
  ObjectTextDiagnosticV01,
  ObjectTextParseResultV01,
  ObjectTextPortV01,
  PortActivation,
  PortV01
} from "@skenion/contracts";
import {
  createSubpatchNodeFromDefinition,
  findPatchDefinition,
  patchDefinitionBoundaryPorts,
  portSpecV02ToGraphPort,
  SUBPATCH_NODE_KIND,
  type PatchDefinitionV02,
  type PatchLibraryV02
} from "./patchLibrary";

export const UNRESOLVED_OBJECT_NODE_KIND = "core.unresolved-object";

const OBJECT_TEXT_SCHEMA = "skenion.object-text.parse-result" as const;
const OBJECT_TEXT_SCHEMA_VERSION = "0.1.0" as const;
const NATIVE_OBJECT_ALIASES = new Map<string, string>([
  ["decode", "core.video-decode"],
  ["upload", "core.gpu-upload"],
  ["preview", "core.preview"]
]);

export interface ObjectTextNodeBuildResult {
  ok: boolean;
  node: GraphNodeV01 | null;
  parseResult: ObjectTextParseResultV01;
  diagnostics: ObjectTextDiagnosticV01[];
}

export interface ObjectTextNodeBuildOptions {
  nodeId?: string;
  patchLibrary?: PatchLibraryV02;
}

export function createGraphNodeFromObjectText(
  input: string,
  existingNodes: GraphNodeV01[],
  registry: NodeDefinitionManifestV01[] = [],
  options: ObjectTextNodeBuildOptions = {}
): ObjectTextNodeBuildResult {
  const displayText = normalizeObjectTextDisplay(input);
  const parseResult = parseObjectTextV01(input);
  if (displayText.length === 0) {
    return {
      ok: false,
      node: null,
      parseResult,
      diagnostics: parseResult.diagnostics
    };
  }

  const subpatchObject = subpatchObjectText(displayText);
  if (subpatchObject) {
    const diagnostics = diagnosticsForSubpatchObjectText(subpatchObject, options.patchLibrary);
    if (diagnostics.length > 0 || !subpatchObject.patchId) {
      const subpatchParseResult = parseResultForSubpatch(
        input,
        displayText,
        subpatchObject.patchId ?? "",
        null,
        false,
        diagnostics
      );
      return unresolvedObjectResult(
        input,
        displayText,
        SUBPATCH_NODE_KIND,
        subpatchParseResult,
        diagnostics,
        existingNodes,
        options.nodeId
      );
    }

    const patchDefinition = findPatchDefinition(options.patchLibrary, subpatchObject.patchId)!;
    const subpatchParseResult = parseResultForSubpatch(
      input,
      displayText,
      subpatchObject.patchId,
      patchDefinition,
      true,
      []
    );

    return {
      ok: true,
      node: createSubpatchNodeFromDefinition(patchDefinition, existingNodes, {
        nodeId: options.nodeId,
        objectText: displayText
      }),
      parseResult: subpatchParseResult,
      diagnostics: []
    };
  }

  const nativeAliasKind = nativeObjectKindForText(displayText);
  if (nativeAliasKind) {
    const definition = registry.find((candidate) => candidate.id === nativeAliasKind);
    if (!definition) {
      const diagnostic = unavailableObjectKindDiagnostic(nativeAliasKind);
      return unresolvedObjectResult(input, displayText, nativeAliasKind, parseResult, [diagnostic], existingNodes, options.nodeId);
    }

    const aliasParseResult = parseResultForNativeAlias(input, displayText, definition);
    return {
      ok: true,
      node: graphNodeFromDefinition(definition, existingNodes, {
        label: displayText,
        objectText: displayText
      }, options.nodeId),
      parseResult: aliasParseResult,
      diagnostics: []
    };
  }

  if (!parseResult.ok || !parseResult.resolvedKind || !parseResult.resolvedKindVersion) {
    const diagnostics = diagnosticsForUnresolvedParse(parseResult);
    return unresolvedObjectResult(
      input,
      parseResult.displayText,
      requestedKindForParseResult(parseResult),
      parseResult,
      diagnostics,
      existingNodes,
      options.nodeId
    );
  }

  const registryDiagnostic = objectTextRegistryDiagnostic(parseResult, registry);
  if (registryDiagnostic) {
    const diagnostics = [...parseResult.diagnostics, registryDiagnostic];
    return unresolvedObjectResult(
      input,
      parseResult.displayText,
      parseResult.resolvedKind,
      parseResult,
      diagnostics,
      existingNodes,
      options.nodeId
    );
  }

  const node: GraphNodeV01 = {
    id: options.nodeId ?? uniqueObjectNodeId(parseResult.resolvedKind, existingNodes),
    kind: parseResult.resolvedKind,
    kindVersion: parseResult.resolvedKindVersion,
    params: {
      ...parseResult.params,
      label: parseResult.displayText,
      objectText: parseResult.displayText
    },
    ports: parseResult.instancePorts.map(objectTextPortToGraphPort)
  };

  return {
    ok: true,
    node,
    parseResult,
    diagnostics: parseResult.diagnostics
  };
}

export function isUnresolvedObjectNode(node: GraphNodeV01): boolean {
  return node.kind === UNRESOLVED_OBJECT_NODE_KIND;
}

export function nativeAliasForObjectKind(kind: string): string | null {
  for (const [alias, nativeKind] of NATIVE_OBJECT_ALIASES) {
    if (nativeKind === kind) {
      return alias;
    }
  }
  return null;
}

export function objectTextRegistryDiagnostic(
  parseResult: ObjectTextParseResultV01,
  registry: NodeDefinitionManifestV01[]
): ObjectTextDiagnosticV01 | null {
  if (!parseResult.ok || !parseResult.resolvedKind || registry.length === 0) {
    return null;
  }

  const definition = registry.find(
    (candidate) =>
      candidate.id === parseResult.resolvedKind &&
      (!parseResult.resolvedKindVersion || candidate.version === parseResult.resolvedKindVersion)
  );
  if (!definition) {
    return unavailableObjectKindDiagnostic(parseResult.resolvedKind);
  }

  return null;
}

export function objectTextPortToGraphPort(port: ObjectTextPortV01): PortV01 {
  const graphPort: PortV01 & { description?: string } = {
    id: port.id,
    direction: port.direction,
    label: labelForObjectTextPort(port.id),
    type: objectTextTypeToGraphType(port.type),
    required: false
  };

  if (port.description) {
    graphPort.description = port.description;
  }
  const activation = graphActivation(port.activation);
  if (port.direction === "input" && activation) {
    graphPort.activation = activation;
  }
  if (Object.hasOwn(port, "defaultValue")) {
    graphPort.default = port.defaultValue;
  }

  return graphPort;
}

export function objectTextTypeToGraphType(type: string): DataTypeV01 {
  const flow = flowForObjectTextType(type);
  const graphType: DataTypeV01 = {
    flow,
    dataKind: type
  };

  const format = defaultFormatForObjectTextType(type);
  if (format) {
    graphType.format = format;
  }

  return graphType;
}

function uniqueObjectNodeId(kind: string, existingNodes: GraphNodeV01[]): string {
  const baseId = kind.slice(kind.lastIndexOf(".") + 1);
  let index = existingNodes.length + 1;
  let id = `${baseId}_${index}`;
  const existingIds = new Set(existingNodes.map((node) => node.id));

  while (existingIds.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }

  return id;
}

function normalizeObjectTextDisplay(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function nativeObjectKindForText(displayText: string): string | null {
  const [classSymbol, ...rest] = displayText.split(/\s+/u).filter(Boolean);
  if (!classSymbol || rest.length > 0) {
    return null;
  }
  return NATIVE_OBJECT_ALIASES.get(classSymbol) ?? null;
}

interface SubpatchObjectText {
  patchId: string | null;
  diagnostics: ObjectTextDiagnosticV01[];
}

function subpatchObjectText(displayText: string): SubpatchObjectText | null {
  const tokens = displayText.split(/\s+/u).filter(Boolean);
  if (tokens[0] !== "p") {
    return null;
  }
  if (tokens.length === 2) {
    return {
      patchId: tokens[1]!,
      diagnostics: []
    };
  }
  if (tokens.length === 1) {
    return {
      patchId: null,
      diagnostics: [
        {
          severity: "error",
          code: "missing-subpatch-id",
          message: "Subpatch object text must include a patch id, such as p oscillator."
        }
      ]
    };
  }
  return {
    patchId: tokens[1],
    diagnostics: [
      {
        severity: "error",
        code: "invalid-subpatch-object-text",
        message: "Subpatch object text accepts exactly one patch id."
      }
    ]
  };
}

function diagnosticsForSubpatchObjectText(
  subpatchObject: SubpatchObjectText,
  patchLibrary: PatchLibraryV02 | undefined
): ObjectTextDiagnosticV01[] {
  if (subpatchObject.diagnostics.length > 0) {
    return subpatchObject.diagnostics;
  }
  const patchId = subpatchObject.patchId as string;
  if (!patchLibrary) {
    return [
      {
        severity: "error",
        code: "patch-library-unavailable",
        message: `Patch library is not available, so p ${patchId} cannot be resolved.`
      }
    ];
  }
  if (!findPatchDefinition(patchLibrary, patchId)) {
    return [
      {
        severity: "error",
        code: "patch-definition-unavailable",
        message: `Patch ${patchId} is not available in the patch library.`
      }
    ];
  }
  return [];
}

function graphNodeFromDefinition(
  definition: NodeDefinitionManifestV01,
  existingNodes: GraphNodeV01[],
  paramsOverride: Record<string, unknown>,
  nodeId?: string
): GraphNodeV01 {
  return {
    id: nodeId ?? uniqueObjectNodeId(definition.id, existingNodes),
    kind: definition.id,
    kindVersion: definition.version,
    params: paramsOverride,
    ports: definition.ports.map(clonePort)
  };
}

function clonePort(port: PortV01): PortV01 {
  return JSON.parse(JSON.stringify(port)) as PortV01;
}

function unresolvedObjectResult(
  input: string,
  displayText: string,
  requestedKind: string,
  parseResult: ObjectTextParseResultV01,
  diagnostics: ObjectTextDiagnosticV01[],
  existingNodes: GraphNodeV01[],
  nodeId?: string
): ObjectTextNodeBuildResult {
  const diagnosticMessage = diagnostics[0].message;
  return {
    ok: false,
    node: {
      id: nodeId ?? uniqueObjectNodeId(UNRESOLVED_OBJECT_NODE_KIND, existingNodes),
      kind: UNRESOLVED_OBJECT_NODE_KIND,
      kindVersion: OBJECT_TEXT_SCHEMA_VERSION,
      params: {
        objectText: displayText,
        diagnosticMessage,
        requestedKind
      },
      ports: []
    },
    parseResult: {
      ...parseResult,
      input,
      displayText,
      ok: false,
      resolvedKind: null,
      resolvedKindVersion: null,
      instancePorts: [],
      diagnostics
    },
    diagnostics
  };
}

function diagnosticsForUnresolvedParse(
  parseResult: ObjectTextParseResultV01
): ObjectTextDiagnosticV01[] {
  const classSymbol = parseResult.classSymbol;
  const firstDiagnostic = parseResult.diagnostics[0];
  if (firstDiagnostic?.code === "unsupported-class") {
    if (!classSymbol.includes(".")) {
      return [
        {
          severity: "error",
          code: "extension-namespace-required",
          message: `Extension object "${classSymbol}" must include a namespace such as "user.${classSymbol}".`
        }
      ];
    }
    return [
      {
        severity: "error",
        code: "unavailable-object-kind",
        message: `${classSymbol} is not available in the local runtime registry.`
      }
    ];
  }
  return parseResult.diagnostics;
}

function requestedKindForParseResult(parseResult: ObjectTextParseResultV01): string {
  return parseResult.resolvedKind ?? parseResult.classSymbol!;
}

function unavailableObjectKindDiagnostic(kind: string): ObjectTextDiagnosticV01 {
  return {
    severity: "error",
    code: "unavailable-object-kind",
    message: `${kind} is not available in the local runtime registry.`
  };
}

function parseResultForNativeAlias(
  input: string,
  displayText: string,
  definition: NodeDefinitionManifestV01
): ObjectTextParseResultV01 {
  return {
    schema: OBJECT_TEXT_SCHEMA,
    schemaVersion: OBJECT_TEXT_SCHEMA_VERSION,
    input,
    ok: true,
    classSymbol: displayText,
    creationArgs: [],
    resolvedKind: definition.id,
    resolvedKindVersion: definition.version,
    params: {},
    instancePorts: definition.ports.map((port) => {
      const objectPort: ObjectTextPortV01 = {
        id: port.id,
        direction: port.direction,
        type: port.type.dataKind
      };
      if ("activation" in port) {
        objectPort.activation = port.activation;
      }
      if ("default" in port) {
        objectPort.defaultValue = port.default;
      }
      return objectPort;
    }),
    displayText,
    diagnostics: []
  };
}

function parseResultForSubpatch(
  input: string,
  displayText: string,
  patchId: string,
  definition: PatchDefinitionV02 | null,
  ok: boolean,
  diagnostics: ObjectTextDiagnosticV01[]
): ObjectTextParseResultV01 {
  return {
    schema: OBJECT_TEXT_SCHEMA,
    schemaVersion: OBJECT_TEXT_SCHEMA_VERSION,
    input,
    ok,
    classSymbol: "p",
    creationArgs: patchId ? [{ type: "symbol", value: patchId } satisfies ObjectTextAtomV01] : [],
    resolvedKind: ok ? SUBPATCH_NODE_KIND : null,
    resolvedKindVersion: ok ? "0.2.0" : null,
    params: patchId ? { patchId } : {},
    instancePorts: definition ? patchDefinitionBoundaryPorts(definition).map(patchPortSpecToObjectTextPort) : [],
    displayText,
    diagnostics
  };
}

function patchPortSpecToObjectTextPort(port: Parameters<typeof portSpecV02ToGraphPort>[0]): ObjectTextPortV01 {
  const graphPort = portSpecV02ToGraphPort(port) as PortV01 & { rate?: ObjectTextPortV01["rate"]; description?: string };
  const objectPort: ObjectTextPortV01 = {
    id: port.id,
    direction: port.direction,
    type: graphPort.type.dataKind
  };
  if (graphPort.rate) {
    objectPort.rate = graphPort.rate;
  }
  if (graphPort.activation) {
    objectPort.activation = graphPort.activation;
  }
  if (Object.hasOwn(graphPort, "default")) {
    objectPort.defaultValue = graphPort.default;
  }
  if (graphPort.description) {
    objectPort.description = graphPort.description;
  }
  return objectPort;
}

function graphActivation(activation: ObjectTextPortV01["activation"]): PortActivation | undefined {
  return activation === "trigger" || activation === "latched" ? activation : undefined;
}

function flowForObjectTextType(type: string): DataFlow {
  if (type === "event.bang" || type === "message.any") {
    return "event";
  }
  if (type === "signal.audio") {
    return "signal";
  }
  if (type === "video.frame") {
    return "stream";
  }
  if (type === "asset.video" || type === "gpu.texture2d") {
    return "resource";
  }
  return "value";
}

function defaultFormatForObjectTextType(type: string): string | undefined {
  if (type === "number.float") {
    return "f32";
  }
  if (type === "number.int") {
    return "i32";
  }
  if (type === "number.uint") {
    return "u32";
  }
  if (type === "color") {
    return "rgba32f";
  }
  return undefined;
}

function labelForObjectTextPort(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
