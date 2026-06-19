import {
  analyzeShaderInterfaceV01,
  shaderInterfaceToPortsV01
} from "@skenion/contracts";
import type {
  GraphNodeV01,
  PortV01,
  ShaderInterfaceAnalysisV01
} from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";

export const FULLSCREEN_SHADER_NODE_KIND = "render.fullscreen-shader";
export const FULLSCREEN_SHADER_LANGUAGE = "wgsl";

export const DEFAULT_FULLSCREEN_SHADER_SOURCE = `// @skenion.uniform speed number.float default=0.5 min=0 max=2 step=0.01 label="Speed"
// @skenion.uniform enabled boolean default=true label="Enabled"
// @skenion.uniform iterations number.int default=8 min=1 max=32 step=1 label="Iterations"
// @skenion.uniform tint color default=[1,0.2,0.1,1] label="Tint"
@fragment
fn fs_main() -> @location(0) vec4<f32> {
  let uv = skenion.resolution / max(skenion.resolution.y, 1.0);
  var pulse = 0.5;
  if (sk_bool(skenion.enabled)) {
    pulse = 0.5 + 0.5 * sin((uv.x + skenion.time * skenion.speed) * f32(skenion.iterations));
  }
  let base = vec3<f32>(0.08 + skenion.speed * 0.35, 0.16 + pulse * 0.45, 0.8 - skenion.speed * 0.2);
  return vec4<f32>(mix(base, skenion.tint.rgb, 0.45), skenion.tint.a);
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

export function analyzeFullscreenShaderInterface(
  source: string,
  language: string = FULLSCREEN_SHADER_LANGUAGE
): ShaderInterfaceAnalysisV01 {
  if (language !== FULLSCREEN_SHADER_LANGUAGE) {
    return {
      ok: false,
      shaderInterface: {
        schema: "skenion.shader.interface",
        schemaVersion: "0.1.0",
        language: FULLSCREEN_SHADER_LANGUAGE,
        uniforms: []
      },
      diagnostics: [
        {
          severity: "error",
          phase: "interface-analysis",
          code: "unsupported-language",
          message: `unsupported shader language: ${language}`,
          source: "user"
        }
      ]
    };
  }

  return analyzeShaderInterfaceV01(source, { language: FULLSCREEN_SHADER_LANGUAGE });
}

export function portsForFullscreenShaderSource(
  source: string,
  language: string = FULLSCREEN_SHADER_LANGUAGE
): PortV01[] {
  const analysis = analyzeFullscreenShaderInterface(source, language);
  return analysis.ok ? shaderInterfaceToPortsV01(analysis.shaderInterface) : fullscreenShaderOutputOnlyPorts();
}

export function createReplaceShaderInterfacePatch(
  nodeId: string,
  source: string,
  language: string = FULLSCREEN_SHADER_LANGUAGE
): GraphPatch | null {
  const analysis = analyzeFullscreenShaderInterface(source, language);
  if (!analysis.ok) {
    return null;
  }

  return {
    type: "replaceNodeInterface",
    nodeId,
    ports: shaderInterfaceToPortsV01(analysis.shaderInterface),
    edgePolicy: "removeInvalidEdges"
  };
}

export function fullscreenShaderPortsAreSynced(
  currentPorts: PortV01[],
  source: string,
  language: string = FULLSCREEN_SHADER_LANGUAGE
): boolean {
  const analysis = analyzeFullscreenShaderInterface(source, language);
  if (!analysis.ok) {
    return false;
  }

  return JSON.stringify(currentPorts) === JSON.stringify(shaderInterfaceToPortsV01(analysis.shaderInterface));
}

function fullscreenShaderOutputOnlyPorts(): PortV01[] {
  return [
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
  ];
}
