import type { GraphDocumentV01 } from "@skenion/contracts";
import { createGraphNodeFromDefinition } from "../graph/skenionGraph";
import { nodeRegistry } from "./registry";

const byId = new Map(nodeRegistry.map((definition) => [definition.id, definition]));

function node(kind: string, id: string, label: string) {
  const definition = byId.get(kind);
  if (!definition) {
    throw new Error(`missing sample node definition ${kind}`);
  }

  return {
    ...createGraphNodeFromDefinition(definition, []),
    id,
    params: {
      label
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
