import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

const meta = {
  title: "Core/Dialog",
  component: Dialog,
  parameters: {
    layout: "centered"
  }
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    children: null,
    onClose: () => undefined,
    opened: true,
    title: "Settings"
  },
  render: () => (
    <Dialog centered onClose={() => undefined} opened title="Settings">
      <Button>Sample Action</Button>
    </Dialog>
  )
};
