import type { NodeDefinitionManifestV01 } from "@skenion/contracts";

export function paletteDirectDefinitions(
  registry: NodeDefinitionManifestV01[]
): NodeDefinitionManifestV01[] {
  return registry.filter((definition) => definition.surface?.palette === "direct");
}
