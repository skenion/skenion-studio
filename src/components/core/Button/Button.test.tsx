// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { theme } from "../../../theme";
import { Button } from "./Button";

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

describe("Button", () => {
  it("renders a shared text action with neutral intent by default", () => {
    const button = renderButton(<Button>Refresh</Button>);

    expect(button.textContent).toContain("Refresh");
    expect(button.getAttribute("data-skenion-core-button")).toBe("button");
    expect(button.getAttribute("data-variant")).toBe("subtle");
  });

  it("keeps selected state as data instead of a required filled background", () => {
    const button = renderButton(<Button selected>Inspect</Button>);

    expect(button.getAttribute("data-selected")).toBe("true");
  });
});

function renderButton(node: React.ReactNode): HTMLButtonElement {
  act(() => {
    root?.render(<MantineProvider theme={theme}>{node}</MantineProvider>);
  });

  const button = container?.querySelector("button");
  if (!button) {
    throw new Error("Expected Button to render a button.");
  }
  return button;
}
