import type { Meta, StoryObj } from "@storybook/react-vite";
import { Group, Stack } from "@mantine/core";
import { PanelRightClose, ScrollText, Settings, Upload } from "lucide-react";
import { IconButton } from "./IconButton";

const meta = {
  title: "Core/IconButton",
  component: IconButton,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <Stack gap="sm" w={260}>
        <Story />
      </Stack>
    )
  ]
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolbarStates: Story = {
  render: () => (
    <Group gap="xs">
      <IconButton icon={<Upload size={18} />} label="Upload" />
      <IconButton color="blue" icon={<ScrollText size={18} />} label="Logs" />
      <IconButton color="blue" icon={<PanelRightClose size={18} />} label="Inspector" selected />
      <IconButton icon={<Settings size={18} />} label="Settings" />
    </Group>
  )
};
