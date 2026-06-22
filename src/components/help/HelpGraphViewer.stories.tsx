import type { Meta, StoryObj } from "@storybook/react-vite";
import type { GraphDocumentV01 } from "@skenion/contracts";
import { getBuiltinNodeHelpGraph } from "@skenion/contracts";
import { HelpGraphViewer } from "./HelpGraphViewer";

const meta = {
  title: "Help/HelpGraphViewer",
  component: HelpGraphViewer,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ height: 420, width: 760 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof HelpGraphViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ValueBangSet: Story = {
  args: {
    graph: getRequiredHelpGraph("core.float")
  },
  render: (args) => <HelpGraphViewer {...args} />
};

export const DynamicShaderInputs: Story = {
  args: {
    graph: getRequiredHelpGraph("render.fullscreen-shader")
  },
  render: (args) => <HelpGraphViewer {...args} />
};

const shaderDiagnosticsHelpGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "help-shader-diagnostics",
  revision: "1",
  nodes: [
    {
      id: "comment_1",
      kind: "core.comment",
      kindVersion: "0.1.0",
      params: {
        text: "This shader contains an intentionally unsupported annotation type so diagnostics can point back to the source line."
      },
      ports: []
    },
    {
      id: "shader_1",
      kind: "render.fullscreen-shader",
      kindVersion: "0.1.0",
      params: {
        label: "Broken Shader",
        language: "wgsl",
        source: "// @skenion.uniform bad texture2d default=0\n@fragment\nfn fs_main() -> @location(0) vec4<f32> {\n  return vec4<f32>(1.0, 0.0, 0.0, 1.0);\n}"
      },
      ports: [
        {
          id: "out",
          direction: "output",
          label: "Out",
          type: "gpu.texture2d",
          rate: "gpu"
        }
      ]
    },
    {
      id: "output_1",
      kind: "render.output",
      kindVersion: "0.1.0",
      params: {
        label: "Render Output"
      },
      ports: [
        {
          id: "in",
          direction: "input",
          label: "In",
          type: "gpu.texture2d",
          rate: "gpu",
          required: true,
          triggerMode: "latched"
        }
      ]
    }
  ],
  edges: [
    {
      id: "edge_shader_output",
      source: {
        nodeId: "shader_1",
        portId: "out"
      },
      target: {
        nodeId: "output_1",
        portId: "in"
      }
    }
  ]
};

export const ShaderDiagnostics: Story = {
  args: {
    graph: shaderDiagnosticsHelpGraph
  },
  render: (args) => <HelpGraphViewer {...args} />
};

function getRequiredHelpGraph(id: string) {
  const graph = getBuiltinNodeHelpGraph(id);
  if (!graph) {
    throw new Error(`Missing builtin help graph ${id}`);
  }
  return graph;
}
