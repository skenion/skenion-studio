import type { Meta, StoryObj } from "@storybook/react-vite";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import { NodeHelp } from "./NodeHelp";

const meta = {
  title: "Help/NodeHelp",
  component: NodeHelp,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof NodeHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ValueF32: Story = {
  args: {
    help: getRequiredHelp("core.value-f32"),
    helpGraph: getBuiltinNodeHelpGraph("core.value-f32")
  },
  render: (args) => <NodeHelp {...args} />
};

export const Toggle: Story = {
  args: {
    help: getRequiredHelp("core.toggle"),
    helpGraph: getBuiltinNodeHelpGraph("core.toggle")
  },
  render: (args) => <NodeHelp {...args} />
};

export const FullscreenShader: Story = {
  args: {
    help: getRequiredHelp("render.fullscreen-shader"),
    helpGraph: getBuiltinNodeHelpGraph("render.fullscreen-shader")
  },
  render: (args) => <NodeHelp {...args} />
};

function getRequiredHelp(id: string) {
  const help = getBuiltinNodeHelp(id);
  if (!help) {
    throw new Error(`Missing builtin help ${id}`);
  }
  return help;
}
