import { describe, expect, it } from "vitest";
import { CLEAR_COLOR_NODE_KIND } from "../graph/clearColor";
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
      ports: [
        {
          id: "u_value",
          direction: "input",
          label: "u_value",
          activation: "latched",
          required: false,
          type: {
            flow: "value",
            dataKind: "f32",
            range: {
              min: 0,
              max: 1,
              step: 0.01
            }
          }
        },
        {
          id: "out",
          direction: "output",
          label: "Out",
          type: {
            flow: "resource",
            dataKind: "gpu.texture2d",
            format: "rgba8unorm",
            colorSpace: "srgb"
          }
        }
      ],
      capabilities: ["render.output.fullscreen-shader"]
    });
  });

  it("includes explicit render output wiring definitions", () => {
    const clear = nodeRegistry.find((candidate) => candidate.id === CLEAR_COLOR_NODE_KIND);
    const output = nodeRegistry.find((candidate) => candidate.id === "render.output");

    expect(clear?.ports).toMatchObject([
      {
        id: "out",
        direction: "output",
        type: {
          flow: "resource",
          dataKind: "gpu.texture2d"
        }
      }
    ]);
    expect(output).toMatchObject({
      id: "render.output",
      displayName: "Render Output",
      category: "Render",
      execution: {
        model: "frame",
        clock: "frame"
      },
      ports: [
        {
          id: "in",
          direction: "input",
          activation: "latched",
          type: {
            flow: "resource",
            dataKind: "gpu.texture2d"
          }
        }
      ],
      capabilities: ["render.output.surface"]
    });
  });

  it("creates fullscreen shader nodes with default wgsl params", () => {
    const definition = nodeRegistry.find((candidate) => candidate.id === FULLSCREEN_SHADER_NODE_KIND);
    const node = createGraphNodeFromDefinition(definition!, []);

    expect(node.params).toEqual(defaultFullscreenShaderParams());
    expect(node.ports.map((port) => port.id)).toEqual(["u_value", "out"]);
    expect(String(node.params.source)).toContain("fn fs_main");
  });
});
