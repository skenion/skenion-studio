import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "@mantine/core";
import { NodePortHandle } from "./NodePortHandle";
import { NodePortRow } from "./NodePortRow";
import {
  eventInputPort,
  gpuTextureOutputPort,
  renderFrameInputPort,
  renderFrameOutputPort,
  valueInputPort,
  valueOutputPort
} from "../../stories/storyFixtures";

const meta = {
  title: "Node/NodePortRow",
  component: NodePortRow,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof NodePortRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RequiredInput: Story = {
  args: {
    port: renderFrameInputPort,
    side: "input"
  }
};

export const ValueNumber: Story = {
  args: {
    port: valueOutputPort,
    side: "output"
  }
};

export const EventBang: Story = {
  args: {
    port: eventInputPort,
    side: "input"
  }
};

export const RenderFrameOutput: Story = {
  args: {
    port: renderFrameOutputPort,
    side: "output"
  }
};

export const GpuTextureResource: Story = {
  args: {
    port: gpuTextureOutputPort,
    side: "output"
  }
};

export const FanInAllowed: Story = {
  args: {
    port: eventInputPort,
    side: "input"
  }
};

export const CompatibleAndIncompatible: Story = {
  args: {
    port: renderFrameInputPort,
    side: "input"
  },
  render: () => (
    <Stack gap="sm">
      <NodePortRow compatible port={renderFrameInputPort} side="input" />
      <NodePortRow incompatible port={eventInputPort} side="input" />
      <NodePortRow incompatible port={valueInputPort} side="input" />
      <NodePortRow compatible port={valueOutputPort} side="output" />
    </Stack>
  )
};

export const CustomHandleSlot: Story = {
  args: {
    handle: <NodePortHandle color={renderFrameOutputPort.color} side="output" />,
    port: renderFrameOutputPort,
    side: "output"
  }
};
