import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import { graphPatchFromStudioAction } from "./graphPatch";
import {
  DEFAULT_FULLSCREEN_SHADER_SOURCE,
  FULLSCREEN_SHADER_LANGUAGE,
  FULLSCREEN_SHADER_NODE_KIND,
  defaultFullscreenShaderParams,
  isFullscreenShaderNode,
  readShaderLanguageParam,
  readShaderSourceParam,
  setShaderSourceParamPatch
} from "./fullscreenShader";

describe("fullscreen shader graph helpers", () => {
  it("identifies fullscreen shader nodes and default params", () => {
    const params = defaultFullscreenShaderParams();

    expect(isFullscreenShaderNode(shaderNode(params.source))).toBe(true);
    expect(isFullscreenShaderNode({ ...shaderNode(params.source), kind: "render.clear-color" })).toBe(false);
    expect(isFullscreenShaderNode(null)).toBe(false);
    expect(params.language).toBe(FULLSCREEN_SHADER_LANGUAGE);
    expect(params.source).toContain("u_value");
    expect(params.source).toContain("fn vs_main");
    expect(params.source).toContain("fn fs_main");
  });

  it("reads shader source and falls back when source is empty", () => {
    expect(readShaderSourceParam(shaderNode("custom source"))).toBe("custom source");
    expect(readShaderSourceParam(shaderNode(""))).toBe(DEFAULT_FULLSCREEN_SHADER_SOURCE);
    expect(readShaderSourceParam({ ...shaderNode("custom"), params: { source: false } })).toBe(
      DEFAULT_FULLSCREEN_SHADER_SOURCE
    );
  });

  it("keeps language fixed to wgsl through the default surface", () => {
    expect(readShaderLanguageParam(shaderNode(DEFAULT_FULLSCREEN_SHADER_SOURCE))).toBe("wgsl");
    expect(readShaderLanguageParam({ ...shaderNode("custom"), params: { language: "glsl", source: "custom" } })).toBe(
      "unsupported"
    );
  });

  it("creates setNodeParam patch operations for shader source edits", () => {
    const patch = setShaderSourceParamPatch("shader_1", "next source");

    expect(patch).toEqual({
      type: "setNodeParam",
      nodeId: "shader_1",
      key: "source",
      value: "next source"
    });
    expect(graphPatchFromStudioAction(patch)).toEqual({
      op: "setNodeParam",
      nodeId: "shader_1",
      key: "source",
      value: "next source"
    });
  });

  function shaderNode(source: unknown): GraphNodeV01 {
    return {
      id: "shader_1",
      kind: FULLSCREEN_SHADER_NODE_KIND,
      kindVersion: "0.1.0",
      params: {
        language: FULLSCREEN_SHADER_LANGUAGE,
        source
      },
      ports: []
    };
  }
});
