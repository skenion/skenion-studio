import type { Meta, StoryObj } from "@storybook/react-vite";
import { Group, Stack } from "@mantine/core";
import { Play, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "./Button";

const meta = {
  title: "Core/Button",
  component: Button,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <Stack gap="sm" w={360}>
        <Story />
      </Stack>
    )
  ]
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const States: Story = {
  render: () => (
    <Group gap="xs">
      <Button leftSection={<RefreshCw size={14} />}>Refresh</Button>
      <Button intent="primary" leftSection={<Play size={14} />} selected>
        Running
      </Button>
      <Button intent="danger" leftSection={<Trash2 size={14} />}>
        Delete
      </Button>
      <Button disabled>Disabled</Button>
    </Group>
  )
};
