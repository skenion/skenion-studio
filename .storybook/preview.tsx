import "@mantine/core/styles.css";
import "@xyflow/react/dist/style.css";
import "../src/styles.css";
import type { Preview } from "@storybook/react-vite";
import { MantineProvider } from "@mantine/core";

const preview: Preview = {
  decorators: [
    (Story) => (
      <MantineProvider defaultColorScheme="light">
        <div style={{ minHeight: "100vh", padding: 24, background: "#f8f9fa" }}>
          <Story />
        </div>
      </MantineProvider>
    )
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    layout: "fullscreen"
  }
};

export default preview;
