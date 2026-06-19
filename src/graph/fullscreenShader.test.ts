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
  analyzeFullscreenShaderInterface,
  createReplaceShaderInterfacePatch,
  fullscreenShaderPortsAreSynced,
  portsForFullscreenShaderSource,
  setShaderSourceParamPatch
} from "./fullscreenShader";

describe("fullscreen shader graph helpers", () => {
  it("identifies fullscreen shader nodes and default params", () => {
    const params = defaultFullscreenShaderParams();

    expect(isFullscreenShaderNode(shaderNode(params.source))).toBe(true);
    expect(isFullscreenShaderNode({ ...shaderNode(params.source), kind: "render.clear-color" })).toBe(false);
    expect(isFullscreenShaderNode(null)).toBe(false);
    expect(params.language).toBe(FULLSCREEN_SHADER_LANGUAGE);
    expect(params.source).toContain("speed");
    expect(params.source).toContain("enabled");
    expect(params.source).toContain("iterations");
    expect(params.source).toContain("tint");
    expect(params.source).not.toContain("fn vs_main");
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

  it("analyzes shader annotations and creates replace interface patches", () => {
    const analysis = analyzeFullscreenShaderInterface(DEFAULT_FULLSCREEN_SHADER_SOURCE);
    const ports = portsForFullscreenShaderSource(DEFAULT_FULLSCREEN_SHADER_SOURCE);
    const patch = createReplaceShaderInterfacePatch("shader_1", DEFAULT_FULLSCREEN_SHADER_SOURCE);

    expect(analysis.ok).toBe(true);
    expect(analysis.shaderInterface.uniforms.map((uniform) => [uniform.id, uniform.type.dataKind])).toEqual([
      ["speed", "number.float"],
      ["enabled", "boolean"],
      ["iterations", "number.int"],
      ["tint", "color"]
    ]);
    expect(ports.map((port) => port.id)).toEqual(["speed", "enabled", "iterations", "tint", "out"]);
    expect(patch).toMatchObject({
      type: "replaceNodeInterface",
      nodeId: "shader_1",
      edgePolicy: "removeInvalidEdges"
    });
    expect(fullscreenShaderPortsAreSynced(ports, DEFAULT_FULLSCREEN_SHADER_SOURCE)).toBe(true);
    expect(fullscreenShaderPortsAreSynced(ports.slice(1), DEFAULT_FULLSCREEN_SHADER_SOURCE)).toBe(false);
  });

  it("falls back to output-only ports when shader analysis fails", () => {
    const source = "// @skenion.uniform out number.float\n@fragment\nfn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }";
    const analysis = analyzeFullscreenShaderInterface(source);

    expect(analysis.ok).toBe(false);
    expect(analyzeFullscreenShaderInterface(source, "glsl").diagnostics[0]?.code).toBe("unsupported-language");
    expect(portsForFullscreenShaderSource(source).map((port) => port.id)).toEqual(["out"]);
    expect(createReplaceShaderInterfacePatch("shader_1", source)).toBeNull();
    expect(fullscreenShaderPortsAreSynced(portsForFullscreenShaderSource(source), source)).toBe(false);
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
