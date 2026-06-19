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

export const Float: Story = {
  args: {
    help: getRequiredHelp("core.float"),
    helpGraph: getBuiltinNodeHelpGraph("core.float")
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

export const Message: Story = {
  args: {
    help: getRequiredHelp("core.message"),
    helpGraph: getBuiltinNodeHelpGraph("core.message")
  },
  render: (args) => <NodeHelp {...args} />
};

export const Panel: Story = {
  args: {
    help: getRequiredHelp("core.panel"),
    helpGraph: getBuiltinNodeHelpGraph("core.panel")
  },
  render: (args) => <NodeHelp {...args} />
};

export const SliderFloat: Story = {
  args: {
    help: getRequiredHelp("ui.slider-float"),
    helpGraph: getBuiltinNodeHelpGraph("ui.slider-float")
  },
  render: (args) => <NodeHelp {...args} />
};

export const UiToggle: Story = {
  args: {
    help: getRequiredHelp("ui.toggle"),
    helpGraph: getBuiltinNodeHelpGraph("ui.toggle")
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
