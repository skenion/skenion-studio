import { describe, expect, it } from "vitest";
import { FULLSCREEN_SHADER_NODE_KIND, defaultFullscreenShaderParams } from "../graph/fullscreenShader";
import { createGraphNodeFromDefinition } from "../graph/skenionGraph";
import { nodeRegistry } from "./registry";

describe("node registry", () => {
  it("includes the fullscreen shader render node", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === FULLSCREEN_SHADER_NODE_KIND);

    expect(definition).toBeDefined();
    expect(definition).toMatchObject({
      id: FULLSCREEN_SHADER_NODE_KIND,
      displayName: "Fullscreen Shader",
      category: "Render",
      execution: {
        model: "gpu_pass",
        clock: "frame"
      },
      ports: [],
      capabilities: ["render.output.fullscreen-shader"]
    });
  });

  it("creates fullscreen shader nodes with default wgsl params", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === FULLSCREEN_SHADER_NODE_KIND);
    const node = createGraphNodeFromDefinition(definition!, []);

    expect(node.params).toEqual(defaultFullscreenShaderParams());
    expect(String(node.params.source)).toContain("fn fs_main");
  });
});
