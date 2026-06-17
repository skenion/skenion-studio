import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { getBuiltinNodeHelp } from "@skenion/contracts";
import { describe, expect, it } from "vitest";
import { NodeHelp } from "./NodeHelp";

describe("NodeHelp", () => {
  it("renders builtin help summary, port docs, and param docs", () => {
    const help = getBuiltinNodeHelp("core.value-f32");
    if (!help) {
      throw new Error("core.value-f32 help is missing");
    }

    const html = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(NodeHelp, { help }))
    );

    expect(html).toContain("Stores and emits");
    expect(html).toContain("control");
    expect(html).toContain("Runtime:");
    expect(html).toContain("in: Updates the stored value and emits it.");
    expect(html).toContain("set: Updates the stored value without emitting.");
    expect(html).toContain("bang: Emits the current stored value without changing it.");
    expect(html).toContain("value: Saved default numeric value.");
    expect(html).toContain("core.bang-button");
  });
});
