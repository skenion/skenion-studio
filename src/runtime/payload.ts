import { createDefaultViewStateForGraph } from "@skenion/contracts";
import type { GraphDocumentV01, NodeDefinitionManifestV01, ViewStateV01 } from "@skenion/contracts";
import type { RuntimeProjectPayload } from "./types";

export function createRuntimeProjectPayload(
  graph: GraphDocumentV01,
  registry: NodeDefinitionManifestV01[],
  viewState?: ViewStateV01
): RuntimeProjectPayload {
  return {
    graph,
    nodes: registry,
    viewState: viewState ?? createDefaultViewStateForGraph(graph)
  };
}
