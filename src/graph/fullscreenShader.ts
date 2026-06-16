import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";

export const FULLSCREEN_SHADER_NODE_KIND = "render.fullscreen-shader";
export const FULLSCREEN_SHADER_LANGUAGE = "wgsl";

export const DEFAULT_FULLSCREEN_SHADER_SOURCE = `struct SkenionFrame {
  resolution: vec2<f32>,
  time: f32,
  frame: u32,
}

@group(0) @binding(0)
var<uniform> skenion: SkenionFrame;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 3.0,  1.0)
  );

  var out: VertexOut;
  out.position = vec4<f32>(positions[vertex_index], 0.0, 1.0);
  return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
  let pulse = 0.5 + 0.5 * sin(skenion.time);
  return vec4<f32>(pulse, 0.2, 0.8, 1.0);
}`;

export function isFullscreenShaderNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === FULLSCREEN_SHADER_NODE_KIND;
}

export function defaultFullscreenShaderParams(): Record<string, unknown> {
  return {
    language: FULLSCREEN_SHADER_LANGUAGE,
    source: DEFAULT_FULLSCREEN_SHADER_SOURCE
  };
}

export function readShaderLanguageParam(node: GraphNodeV01): string {
  return node.params.language === FULLSCREEN_SHADER_LANGUAGE ? FULLSCREEN_SHADER_LANGUAGE : "unsupported";
}

export function readShaderSourceParam(node: GraphNodeV01): string {
  return typeof node.params.source === "string" && node.params.source.trim().length > 0
    ? node.params.source
    : DEFAULT_FULLSCREEN_SHADER_SOURCE;
}

export function setShaderSourceParamPatch(nodeId: string, source: string): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "source",
    value: source
  };
}
