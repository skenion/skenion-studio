import { parseObjectTextV01 } from "@skenion/contracts";
import type {
  DataFlow,
  DataTypeV01,
  GraphNodeV01,
  NodeDefinitionManifestV01,
  ObjectTextDiagnosticV01,
  ObjectTextParseResultV01,
  ObjectTextPortV01,
  PortActivation,
  PortV01
} from "@skenion/contracts";

export interface ObjectTextNodeBuildResult {
  ok: boolean;
  node: GraphNodeV01 | null;
  parseResult: ObjectTextParseResultV01;
  diagnostics: ObjectTextDiagnosticV01[];
}

export function createGraphNodeFromObjectText(
  input: string,
  existingNodes: GraphNodeV01[],
  registry: NodeDefinitionManifestV01[] = []
): ObjectTextNodeBuildResult {
  const parseResult = parseObjectTextV01(input);

  if (!parseResult.ok || !parseResult.resolvedKind || !parseResult.resolvedKindVersion) {
    return {
      ok: false,
      node: null,
      parseResult,
      diagnostics: parseResult.diagnostics
    };
  }

  const registryDiagnostic = objectTextRegistryDiagnostic(parseResult, registry);
  if (registryDiagnostic) {
    return {
      ok: false,
      node: null,
      parseResult,
      diagnostics: [...parseResult.diagnostics, registryDiagnostic]
    };
  }

  const node: GraphNodeV01 = {
    id: uniqueObjectNodeId(parseResult.resolvedKind, existingNodes),
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
    return {
      severity: "error",
      code: "unavailable-object-kind",
      message: `${parseResult.resolvedKind} is not available in the local runtime registry.`
    };
  }

  const ports = parseResult.instancePorts.map(objectTextPortToGraphPort);
  const mismatch = firstPortMismatch(definition.ports, ports);
  if (mismatch) {
    return {
      severity: "error",
      code: "unsupported-object-interface",
      message: `${parseResult.displayText} resolves to ${parseResult.resolvedKind}, but ${mismatch}`
    };
  }

  return null;
}

export function objectTextPortToGraphPort(port: ObjectTextPortV01): PortV01 {
  const graphPort: PortV01 = {
    id: port.id,
    direction: port.direction,
    label: labelForObjectTextPort(port.id),
    type: objectTextTypeToGraphType(port.type),
    required: false
  };

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

function firstPortMismatch(expected: PortV01[], actual: PortV01[]): string | null {
  if (expected.length !== actual.length) {
    return `the parser produced ${actual.length} ports while the registry expects ${expected.length}.`;
  }

  for (const expectedPort of expected) {
    const actualPort = actual.find((port) => port.id === expectedPort.id);
    if (!actualPort) {
      return `the parser did not produce registry port '${expectedPort.id}'.`;
    }

    if (expectedPort.direction !== actualPort.direction) {
      return `${expectedPort.id} is ${actualPort.direction}, expected ${expectedPort.direction}.`;
    }

    if (expectedPort.type.flow !== actualPort.type.flow || expectedPort.type.dataKind !== actualPort.type.dataKind) {
      return `${expectedPort.id} is ${typeDescription(actualPort.type)}, expected ${typeDescription(expectedPort.type)}.`;
    }

    if ((expectedPort.type.format ?? null) !== (actualPort.type.format ?? null)) {
      return `${expectedPort.id} uses format ${String(actualPort.type.format ?? "none")}, expected ${String(expectedPort.type.format ?? "none")}.`;
    }

    if ((expectedPort.activation ?? null) !== (actualPort.activation ?? null)) {
      return `${expectedPort.id} uses activation ${String(actualPort.activation ?? "none")}, expected ${String(expectedPort.activation ?? "none")}.`;
    }
  }

  return null;
}

function typeDescription(type: DataTypeV01): string {
  return `${type.flow}<${type.dataKind}>`;
}
