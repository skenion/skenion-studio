import { DEFAULT_FULLSCREEN_SHADER_SOURCE, portsForFullscreenShaderSource } from "../graph/fullscreenShader";
import type { DisplayGraphDocumentV01 } from "../graph/patchLibrary";
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

export const MULTI_UNIFORM_SHADER_SOURCE = `// @skenion.uniform speed number.float default=0.25 min=0 max=2 step=0.01 label="Speed"
// @skenion.uniform phase number.float default=0.65 min=0 max=1 step=0.01 label="Phase"
// @skenion.uniform tint color default=[0.95,0.25,0.12,1] label="Tint"
@fragment
fn fs_main() -> @location(0) vec4<f32> {
  let pulse = 0.5 + 0.5 * sin(skenion.time * (1.0 + skenion.speed * 2.0) + skenion.phase * 6.28318);
  let base = vec3<f32>(skenion.speed, pulse, 1.0 - skenion.phase);
  return vec4<f32>(mix(base, skenion.tint.rgb, 0.5), skenion.tint.a);
}`;

export const OBJECT_ROUTING_PANEL_SHADER_SOURCE = `// @skenion.uniform speed number.float default=0.75 min=0 max=2 step=0.01
// @skenion.uniform enabled boolean default=true
@fragment
fn fs_main() -> @location(0) vec4<f32> {
  let pulse = 0.5 + 0.5 * sin(skenion.time * skenion.speed);
  let active = vec4<f32>(pulse, skenion.speed / 2.0, 1.0 - pulse, 1.0);
  return select(vec4<f32>(0.04, 0.04, 0.04, 1.0), active, sk_bool(skenion.enabled));
}`;

export const sampleGraph: DisplayGraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-sample",
  revision: "1",
  nodes: [
    node("core.float", "value_1", "Float"),
    node("core.float", "target_1", "Target"),
    node("core.bang", "bang_1", "Trigger"),
    node("core.message", "event_log_1", "Log"),
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
        port: "in"
      }
    },
    {
      from: {
        node: "bang_1",
        port: "out"
      },
      to: {
        node: "event_log_1",
        port: "in"
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

export const renderSampleGraph: DisplayGraphDocumentV01 = {
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

export const shaderUniformSampleGraph: DisplayGraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-shader-uniform-sample",
  revision: "1",
  nodes: [
    node("core.float", "value_1", "speed", { value: 0.2 }),
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

export const shaderMultiUniformSampleGraph: DisplayGraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-shader-multi-uniform-sample",
  revision: "1",
  nodes: [
    node("core.float", "value_1", "speed", { value: 0.25 }),
    node("core.float", "value_2", "phase", { value: 0.65 }),
    node("core.color", "color_1", "tint", { value: [0.95, 0.25, 0.12, 1] }),
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

export const objectRoutingPanelSampleGraph: DisplayGraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-object-routing-panel-sample",
  revision: "1",
  nodes: [
    node("core.float", "slider_speed", "Speed", {
      value: 0.75,
      min: 0,
      max: 2,
      step: 0.01,
      widget: "slider",
      sendName: "speed"
    }),
    node("core.bool", "toggle_enabled", "Enabled", {
      value: true,
      widget: "toggle",
      sendName: "enabled"
    }),
    node("render.fullscreen-shader", "shader_1", "Fullscreen Shader", {
      source: OBJECT_ROUTING_PANEL_SHADER_SOURCE
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

export const objectRoutingPanelSamplePositions: ViewPositions = {
  slider_speed: { x: 64, y: 64 },
  toggle_enabled: { x: 64, y: 240 },
  shader_1: { x: 420, y: 150 },
  output_1: { x: 760, y: 210 }
};
export const objectRoutingPanelSampleViewState = createViewStateFromPositions(
  objectRoutingPanelSampleGraph,
  objectRoutingPanelSamplePositions
);

export const objectVisualSampleGraph: DisplayGraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-object-visual-sample",
  revision: "1",
  nodes: [
    node("core.panel", "panel_1", "Panel", {
      label: "Tempo Panel",
      color: "transparent",
      receiveName: "panelColor"
    }),
    node("core.comment", "comment_1", "Comment", {
      text: "set <text> updates this comment inlet",
      receiveName: "statusText"
    }),
    node("core.message", "message_1", "Message", {
      value: "set #00ff00"
    }),
    node("core.bang", "button_1", "Bang", {
      label: "Bang"
    }),
    node("core.bool", "toggle_1", "Toggle", {
      label: "Enabled",
      widget: "toggle",
      value: true
    }),
    node("core.float", "slider_1", "Slider", {
      label: "Speed",
      value: 0.65,
      min: 0,
      max: 1,
      step: 0.01,
      widget: "slider",
      sendName: "speed"
    }),
    node("core.float", "value_1", "Float", {
      value: 0.5,
      receiveName: "speed"
    }),
    node("core.video-asset", "asset_1", "Video Asset", {
      assetRef: "skenion-runtime://assets/demo_clip",
      name: "demo_clip.mp4",
      mimeType: "video/mp4"
    })
  ],
  edges: [
    {
      from: {
        node: "button_1",
        port: "out"
      },
      to: {
        node: "message_1",
        port: "in"
      }
    },
    {
      from: {
        node: "slider_1",
        port: "value"
      },
      to: {
        node: "value_1",
        port: "in"
      }
    }
  ]
};

export const objectVisualSamplePositions: ViewPositions = {
  panel_1: { x: 48, y: 42 },
  comment_1: { x: 338, y: 70 },
  message_1: { x: 338, y: 210 },
  button_1: { x: 48, y: 218 },
  toggle_1: { x: 48, y: 352 },
  slider_1: { x: 338, y: 352 },
  value_1: { x: 686, y: 364 },
  asset_1: { x: 686, y: 96 }
};
export const objectVisualSampleViewState = createViewStateFromPositions(
  objectVisualSampleGraph,
  objectVisualSamplePositions
);

export const portDemoSampleGraph: DisplayGraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "studio-port-demo-sample",
  revision: "1",
  nodes: [
    node("core.float", "value_1", "Float Value", { value: 0.65 }),
    node("core.float", "target_1", "Value Target"),
    node("core.bang", "bang_1", "Bang"),
    node("core.message", "event_log_1", "Event Log"),
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
        port: "in"
      }
    },
    {
      from: {
        node: "bang_1",
        port: "out"
      },
      to: {
        node: "event_log_1",
        port: "in"
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
