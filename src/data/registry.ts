import type { NodeDefinitionManifestV01, PortV01 } from "@skenion/contracts";

const f32Value = {
  flow: "value",
  dataKind: "f32",
  range: {
    min: 0,
    max: 1,
    step: 0.01
  }
} as const;

const bangEvent = {
  flow: "event",
  dataKind: "bang"
} as const;

const videoAsset = {
  flow: "resource",
  dataKind: "asset.video"
} as const;

const videoFrame = {
  flow: "stream",
  dataKind: "video.frame",
  frameRate: 60,
  colorSpace: "srgb",
  alphaPolicy: "black"
} as const;

const gpuTexture = {
  flow: "resource",
  dataKind: "gpu.texture2d",
  format: "rgba8unorm",
  colorSpace: "srgb"
} as const;

function input(id: string, label: string, type: PortV01["type"], activation: PortV01["activation"]): PortV01 {
  return {
    id,
    label,
    direction: "input",
    type,
    required: true,
    activation
  };
}

function output(id: string, label: string, type: PortV01["type"]): PortV01 {
  return {
    id,
    label,
    direction: "output",
    type
  };
}

function definition(
  id: string,
  displayName: string,
  category: string,
  ports: PortV01[],
  model: NodeDefinitionManifestV01["execution"]["model"]
): NodeDefinitionManifestV01 {
  return {
    schema: "skenion.node.definition",
    schemaVersion: "0.1.0",
    id,
    version: "0.1.0",
    displayName,
    category,
    ports,
    execution: {
      model
    },
    state: {
      persistent: false
    },
    permissions: [],
    capabilities: []
  };
}

export const nodeRegistry: NodeDefinitionManifestV01[] = [
  definition("core.value-f32", "Float Value", "Values", [output("value", "Value", f32Value)], "value"),
  definition("core.target", "Value Target", "Values", [input("value", "Value", f32Value, "latched")], "value"),
  definition("core.bang-button", "Bang Button", "Events", [output("bang", "Bang", bangEvent)], "event"),
  definition("core.event-log", "Event Log", "Events", [input("bang", "Bang", bangEvent, "trigger")], "event"),
  definition("core.video-asset", "Video Asset", "Media", [output("asset", "Asset", videoAsset)], "async_resource"),
  definition(
    "core.video-decode",
    "Video Decode",
    "Converters",
    [input("asset", "Asset", videoAsset, "latched"), output("frames", "Frames", videoFrame)],
    "video_frame"
  ),
  definition(
    "core.gpu-upload",
    "GPU Upload",
    "Converters",
    [input("frames", "Frames", videoFrame, "latched"), output("texture", "Texture", gpuTexture)],
    "gpu_pass"
  ),
  definition(
    "core.preview",
    "Preview",
    "Output",
    [input("texture", "Texture", gpuTexture, "latched")],
    "frame"
  ),
  {
    schema: "skenion.node.definition",
    schemaVersion: "0.1.0",
    id: "render.clear-color",
    version: "0.1.0",
    displayName: "Clear Color",
    category: "Render",
    ports: [output("out", "Out", gpuTexture)],
    execution: {
      model: "gpu_pass",
      clock: "frame"
    },
    state: {
      persistent: false
    },
    permissions: [],
    capabilities: ["render.output.clear-color"]
  },
  {
    schema: "skenion.node.definition",
    schemaVersion: "0.1.0",
    id: "render.fullscreen-shader",
    version: "0.1.0",
    displayName: "Fullscreen Shader",
    category: "Render",
    ports: [output("out", "Out", gpuTexture)],
    execution: {
      model: "gpu_pass",
      clock: "frame"
    },
    state: {
      persistent: false
    },
    permissions: [],
    capabilities: ["render.output.fullscreen-shader"]
  },
  {
    schema: "skenion.node.definition",
    schemaVersion: "0.1.0",
    id: "render.output",
    version: "0.1.0",
    displayName: "Render Output",
    category: "Render",
    ports: [input("in", "In", gpuTexture, "latched")],
    execution: {
      model: "frame",
      clock: "frame"
    },
    state: {
      persistent: false
    },
    permissions: [],
    capabilities: ["render.output.surface"]
  }
];
