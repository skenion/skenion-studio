import "@mantine/core/styles.css";
import "@xyflow/react/dist/style.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import App from "./App";
import "./styles.css";
import { createCookieBackedColorSchemeManager } from "./colorScheme";
import { theme } from "./theme";

const colorSchemeManager = createCookieBackedColorSchemeManager();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="light"
      deduplicateInlineStyles
      theme={theme}
    >
      <App />
    </MantineProvider>
  </React.StrictMode>
);
