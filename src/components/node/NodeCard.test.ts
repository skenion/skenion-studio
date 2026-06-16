import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { NodeCard } from "./NodeCard";
import { NodePortHandle } from "./NodePortHandle";
import { multiPortCard, shaderUniformCard, zeroPortCard } from "../../stories/storyFixtures";
import type { NodePortSide, NodePortView } from "./nodeTypes";

describe("NodeCard", () => {
  it("renders explicit input and output columns with handle dots", () => {
    const html = renderNodeCard(shaderUniformCard);

    expect(html).toContain("IN");
    expect(html).toContain("OUT");
    expect(html).toContain("u_value");
    expect(html).toContain("out");
    expect(html).toContain("node-port-dot-input");
    expect(html).toContain("node-port-dot-output");
  });

  it("renders empty inlet and outlet states for zero-port nodes", () => {
    const html = renderNodeCard(zeroPortCard);

    expect(html).toContain("No inlets");
    expect(html).toContain("No outlets");
  });

  it("renders a handle for every input and output port", () => {
    const html = renderNodeCard(multiPortCard);

    expect(countOccurrences(html, "node-port-dot-input")).toBe(multiPortCard.inputs.length);
    expect(countOccurrences(html, "node-port-dot-output")).toBe(multiPortCard.outputs.length);
  });
});

function renderNodeCard(card: Parameters<typeof NodeCard>[0]): string {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(NodeCard, {
        ...card,
        renderInputHandle: renderHandle,
        renderOutputHandle: renderHandle
      })
    )
  );
}

function renderHandle(port: NodePortView, side: NodePortSide) {
  return createElement(NodePortHandle, {
    color: port.color,
    side
  });
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}
