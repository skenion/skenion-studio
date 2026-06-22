import { builtinNodeDefinitionsV01 } from "@skenion/contracts";
import type { NodeDefinitionManifestV01 } from "@skenion/contracts";

export const nodeRegistry: NodeDefinitionManifestV01[] = builtinNodeDefinitionsV01.map(cloneDefinition);

function cloneDefinition(definition: NodeDefinitionManifestV01): NodeDefinitionManifestV01 {
  return {
    ...definition,
    ports: definition.ports.map((port) => {
      const clonedPort = { ...port };
      return Object.hasOwn(port, "defaultValue")
        ? { ...clonedPort, defaultValue: cloneDefault(port.defaultValue) }
        : clonedPort;
    }),
    execution: { ...definition.execution },
    state: { ...definition.state },
    permissions: [...definition.permissions],
    capabilities: [...definition.capabilities]
  };
}

function cloneDefault(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value && typeof value === "object") {
    return { ...(value as Record<string, unknown>) };
  }
  return value;
}
