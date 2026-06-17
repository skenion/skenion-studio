import type { GraphDocumentV01 } from "@skenion/contracts";
import { DEFAULT_FULLSCREEN_SHADER_SOURCE, portsForFullscreenShaderSource } from "../graph/fullscreenShader";
import { createViewStateFromPositions, type ViewPositions } from "../graph/projectDocument";
import { createGraphNodeFromDefinition } from "../graph/skenionGraph";
import { nodeRegistry } from "./registry";

const byId = new Map(nodeRegistry.map((definition) => [definition.id, definition]));

function node(kind: string, id: string, label: string, params: Record<string, unknown> = {}) {
  const definition = byId.get(kind);
  if (!definition) {
    throw new Error(`missing sample node definition ${kind}`);
  }

  const created = createGraphNodeFromDefinition(definition, []);
  const nextParams: Record<string, unknown> = {
    ...created.params,
    label,
    ...params
  };
  return {
    ...created,
    id,
    params: nextParams,
    ports:
      kind === "render.fullscreen-shader"
        ? portsForFullscreenShaderSource(String(nextParams.source ?? DEFAULT_FULLSCREEN_SHADER_SOURCE))
        : created.ports
  };
}

export const MULTI_UNIFORM_SHADER_SOURCE = `// @skenion.uniform speed number.f32 default=0.25 min=0 max=2 step=0.01 label="Speed"
// @skenion.uniform phase number.f32 default=0.65 min=0 max=1 step=0.01 label="Phase"
// @skenion.uniform tint color.rgba default=[0.95,0.25,0.12,1] label="Tint"
@fragment
fn fs_main() -> @location(0) vec4<f32> {
  let pulse = 0.5 + 0.5 * sin(skenion.time * (1.0 + skenion.speed * 2.0) + skenion.phase * 6.28318);
  let base = vec3<f32>(skenion.speed, pulse, 1.0 - skenion.phase);
  return vec4<f32>(mix(base, skenion.tint.rgb, 0.5), skenion.tint.a);
}`;

export const SEND_RECEIVE_PANEL_SHADER_SOURCE = `// @skenion.uniform speed number.f32 default=0.75 min=0 max=2 step=0.01
// @skenion.uniform enabled boolean default=true
@fragment
fn fs_main() -> @location(0) vec4<f32> {
  let pulse = 0.5 + 0.5 * sin(skenion.time * skenion.speed);
  let active = vec4<f32>(pulse, skenion.speed / 2.0, 1.0 - pulse, 1.0);
  return select(vec4<f32>(0.04, 0.04, 0.04, 1.0), active, sk_bool(skenion.enabled));
}`;

export const sampleGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-sample",
  revision: "1",
  nodes: [
    node("core.value-f32", "value_1", "Float"),
    node("core.target", "target_1", "Target"),
    node("core.bang-button", "bang_1", "Trigger"),
    node("core.event-log", "event_log_1", "Log"),
    node("core.video-asset", "video_asset_1", "Clip"),
    node("core.video-decode", "decode_1", "Decode"),
    node("core.gpu-upload", "gpu_upload_1", "Upload"),
    node("core.preview", "preview_1", "Preview")
  ],
  edges: [
    {
      from: {
        node: "value_1",
        port: "value"
      },
      to: {
        node: "target_1",
        port: "value"
      }
    },
    {
      from: {
        node: "bang_1",
        port: "bang"
      },
      to: {
        node: "event_log_1",
        port: "bang"
      }
    },
    {
      from: {
        node: "video_asset_1",
        port: "asset"
      },
      to: {
        node: "decode_1",
        port: "asset"
      }
    },
    {
      from: {
        node: "decode_1",
        port: "frames"
      },
      to: {
        node: "gpu_upload_1",
        port: "frames"
      }
    },
    {
      from: {
        node: "gpu_upload_1",
        port: "texture"
      },
      to: {
        node: "preview_1",
        port: "texture"
      }
    }
  ]
};

export const renderSampleGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-render-sample",
  revision: "1",
  nodes: [
    node("render.fullscreen-shader", "shader_1", "Fullscreen Shader"),
    node("render.output", "output_1", "Preview Output")
  ],
  edges: [
    {
      from: {
        node: "shader_1",
        port: "out"
      },
      to: {
        node: "output_1",
        port: "in"
      }
    }
  ]
};

export const shaderUniformSampleGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-shader-uniform-sample",
  revision: "1",
  nodes: [
    node("core.value-f32", "value_1", "speed", { value: 0.2 }),
    node("render.fullscreen-shader", "shader_1", "Fullscreen Shader"),
    node("render.output", "output_1", "Preview Output")
  ],
  edges: [
    {
      from: {
        node: "value_1",
        port: "value"
      },
      to: {
        node: "shader_1",
        port: "speed"
      }
    },
    {
      from: {
        node: "shader_1",
        port: "out"
      },
      to: {
        node: "output_1",
        port: "in"
      }
    }
  ]
};

export const shaderUniformSamplePositions: ViewPositions = {
  value_1: { x: 64, y: 120 },
  shader_1: { x: 364, y: 120 },
  output_1: { x: 664, y: 120 }
};
export const shaderUniformSampleViewState = createViewStateFromPositions(
  shaderUniformSampleGraph,
  shaderUniformSamplePositions
);

export const shaderMultiUniformSampleGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-shader-multi-uniform-sample",
  revision: "1",
  nodes: [
    node("core.value-f32", "value_1", "speed", { value: 0.25 }),
    node("core.value-f32", "value_2", "phase", { value: 0.65 }),
    node("core.color-rgba", "color_1", "tint", { value: [0.95, 0.25, 0.12, 1] }),
    node("render.fullscreen-shader", "shader_1", "Fullscreen Shader", {
      source: MULTI_UNIFORM_SHADER_SOURCE
    }),
    node("render.output", "output_1", "Preview Output")
  ],
  edges: [
    {
      from: {
        node: "value_1",
        port: "value"
      },
      to: {
        node: "shader_1",
        port: "speed"
      }
    },
    {
      from: {
        node: "value_2",
        port: "value"
      },
      to: {
        node: "shader_1",
        port: "phase"
      }
    },
    {
      from: {
        node: "color_1",
        port: "value"
      },
      to: {
        node: "shader_1",
        port: "tint"
      }
    },
    {
      from: {
        node: "shader_1",
        port: "out"
      },
      to: {
        node: "output_1",
        port: "in"
      }
    }
  ]
};

export const shaderMultiUniformSamplePositions: ViewPositions = {
  value_1: { x: 64, y: 40 },
  value_2: { x: 64, y: 250 },
  color_1: { x: 64, y: 460 },
  shader_1: { x: 440, y: 278 },
  output_1: { x: 780, y: 318 }
};
export const shaderMultiUniformSampleViewState = createViewStateFromPositions(
  shaderMultiUniformSampleGraph,
  shaderMultiUniformSamplePositions
);

export const sendReceivePanelSampleGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-send-receive-panel-sample",
  revision: "1",
  nodes: [
    node("ui.slider-f32", "slider_speed", "Speed", { value: 0.75, min: 0, max: 2, step: 0.01 }),
    node("core.send-f32", "send_speed", "Send Speed", { name: "speed" }),
    node("core.receive-f32", "receive_speed", "Receive Speed", { name: "speed", default: 0.75 }),
    node("ui.toggle", "toggle_enabled", "Enabled", { value: true }),
    node("core.send-bool", "send_enabled", "Send Enabled", { name: "enabled" }),
    node("core.receive-bool", "receive_enabled", "Receive Enabled", { name: "enabled", default: true }),
    node("render.fullscreen-shader", "shader_1", "Fullscreen Shader", {
      source: SEND_RECEIVE_PANEL_SHADER_SOURCE
    }),
    node("render.output", "output_1", "Preview Output")
  ],
  edges: [
    {
      from: {
        node: "slider_speed",
        port: "value"
      },
      to: {
        node: "send_speed",
        port: "in"
      }
    },
    {
      from: {
        node: "receive_speed",
        port: "value"
      },
      to: {
        node: "shader_1",
        port: "speed"
      }
    },
    {
      from: {
        node: "toggle_enabled",
        port: "value"
      },
      to: {
        node: "send_enabled",
        port: "in"
      }
    },
    {
      from: {
        node: "receive_enabled",
        port: "value"
      },
      to: {
        node: "shader_1",
        port: "enabled"
      }
    },
    {
      from: {
        node: "shader_1",
        port: "out"
      },
      to: {
        node: "output_1",
        port: "in"
      }
    }
  ]
};

export const sendReceivePanelSamplePositions: ViewPositions = {
  slider_speed: { x: 64, y: 64 },
  send_speed: { x: 364, y: 64 },
  receive_speed: { x: 364, y: 260 },
  toggle_enabled: { x: 64, y: 408 },
  send_enabled: { x: 364, y: 408 },
  receive_enabled: { x: 364, y: 604 },
  shader_1: { x: 704, y: 260 },
  output_1: { x: 1044, y: 320 }
};
export const sendReceivePanelSampleViewState = createViewStateFromPositions(
  sendReceivePanelSampleGraph,
  sendReceivePanelSamplePositions
);

export const portDemoSampleGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-port-demo-sample",
  revision: "1",
  nodes: [
    node("core.value-f32", "value_1", "Float Value", { value: 0.65 }),
    node("core.target", "target_1", "Value Target"),
    node("core.bang-button", "bang_1", "Bang Button"),
    node("core.event-log", "event_log_1", "Event Log"),
    node("render.fullscreen-shader", "shader_1", "Fullscreen Shader"),
    node("render.output", "output_1", "Render Output")
  ],
  edges: [
    {
      from: {
        node: "value_1",
        port: "value"
      },
      to: {
        node: "target_1",
        port: "value"
      }
    },
    {
      from: {
        node: "bang_1",
        port: "bang"
      },
      to: {
        node: "event_log_1",
        port: "bang"
      }
    },
    {
      from: {
        node: "shader_1",
        port: "out"
      },
      to: {
        node: "output_1",
        port: "in"
      }
    }
  ]
};

export const portDemoSamplePositions: ViewPositions = {
  value_1: { x: 64, y: 56 },
  target_1: { x: 384, y: 84 },
  bang_1: { x: 64, y: 300 },
  event_log_1: { x: 384, y: 300 },
  shader_1: { x: 64, y: 500 },
  output_1: { x: 384, y: 528 }
};
export const portDemoSampleViewState = createViewStateFromPositions(
  portDemoSampleGraph,
  portDemoSamplePositions
);
