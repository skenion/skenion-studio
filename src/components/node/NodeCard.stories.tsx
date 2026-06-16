import type { Meta, StoryObj } from "@storybook/react-vite";
import { Group, Stack } from "@mantine/core";
import { NodeCard } from "./NodeCard";
import { NodePortHandle } from "./NodePortHandle";
import {
  multiPortCard,
  renderCard,
  targetCard,
  zeroPortCard
} from "../../stories/storyFixtures";

const meta = {
  title: "Node/NodeCard",
  component: NodeCard,
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof NodeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ZeroPorts: Story = {
  args: zeroPortCard
};

export const RenderOutputPair: Story = {
  args: renderCard,
  render: () => (
    <Group align="flex-start" gap="xl">
      <NodeCard {...renderCard} />
      <NodeCard {...targetCard} selected />
    </Group>
  )
};

export const MultiInputOutput: Story = {
  args: multiPortCard
};

export const WithVisibleHandleDots: Story = {
  args: renderCard,
  render: () => (
    <Stack gap="lg">
      <NodeCard
        {...renderCard}
        renderOutputHandle={(port, side) => <NodePortHandle color={port.color} side={side} />}
      />
      <NodeCard
        {...multiPortCard}
        renderInputHandle={(port, side) => <NodePortHandle color={port.color} side={side} />}
        renderOutputHandle={(port, side) => <NodePortHandle color={port.color} side={side} />}
      />
    </Stack>
  )
};
