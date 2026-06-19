import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { getBuiltinNodeHelp } from "@skenion/contracts";
import { describe, expect, it } from "vitest";
import { NodeHelp } from "./NodeHelp";

describe("NodeHelp", () => {
  it("renders builtin help summary, port docs, and param docs", () => {
    const help = getBuiltinNodeHelp("core.float");
    if (!help) {
      throw new Error("core.float help is missing");
    }

    const html = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(NodeHelp, { help }))
    );

    expect(html).toContain("Stores and emits");
    expect(html).toContain("control");
    expect(html).toContain("Runtime:");
    expect(html).toContain("in: Hot inlet:");
    expect(html).toContain("bang emits the stored value");
    expect(html).toContain("set ... updates silently");
    expect(html).toContain("cold: Cold inlet:");
    expect(html).toContain("value: Saved default numeric value.");
    expect(html).toContain("widget: Optional display widget.");
  });
});
