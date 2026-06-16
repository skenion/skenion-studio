import type { GraphDocumentV01 } from "@skenion/contracts";
import { createGraphNodeFromDefinition } from "../graph/skenionGraph";
import { nodeRegistry } from "./registry";

const byId = new Map(nodeRegistry.map((definition) => [definition.id, definition]));

function node(kind: string, id: string, label: string, params: Record<string, unknown> = {}) {
  const definition = byId.get(kind);
  if (!definition) {
    throw new Error(`missing sample node definition ${kind}`);
  }

  const created = createGraphNodeFromDefinition(definition, []);
  return {
    ...created,
    id,
    params: {
      ...created.params,
      label,
      ...params
    }
  };
}

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
    node("core.value-f32", "value_1", "u_value", { value: 0.2 }),
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
        port: "u_value"
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
