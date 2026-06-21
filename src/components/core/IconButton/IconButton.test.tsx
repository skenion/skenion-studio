// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { theme } from "../../../theme";
import { IconButton } from "./IconButton";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe("IconButton", () => {
  it("renders an accessible transparent icon action", () => {
    const button = renderIconButton(<IconButton icon="S" label="Settings" />);

    expect(button.getAttribute("aria-label")).toBe("Settings");
    expect(button.getAttribute("data-skenion-core-button")).toBe("icon");
    expect(button.getAttribute("data-variant")).toBe("subtle");
  });

  it("marks selected icon actions without relying on a persistent background", () => {
    const button = renderIconButton(<IconButton icon="I" label="Inspector" selected />);

    expect(button.getAttribute("data-selected")).toBe("true");
  });
});

function renderIconButton(node: React.ReactNode): HTMLButtonElement {
  act(() => {
    root?.render(<MantineProvider theme={theme}>{node}</MantineProvider>);
  });

  const button = container?.querySelector("button");
  if (!button) {
    throw new Error("Expected IconButton to render a button.");
  }
  return button;
}
