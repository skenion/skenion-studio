import type { GraphDocumentV01, NodeDefinitionManifestV01 } from "@skenion/contracts";
import type { RuntimeProjectPayload } from "./types";

export function createRuntimeProjectPayload(
  graph: GraphDocumentV01,
  registry: NodeDefinitionManifestV01[]
): RuntimeProjectPayload {
  return {
    graph,
    nodes: registry
  };
}

