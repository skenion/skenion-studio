import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { theme } from "../../theme";
import { NodeCard } from "./NodeCard";
import { NodePortHandle } from "./NodePortHandle";
import { multiPortCard, shaderUniformCard, zeroPortCard } from "../../stories/storyFixtures";
import type { NodePortSide, NodePortView } from "./nodeTypes";

describe("NodeCard", () => {
  it("renders explicit input and output columns with shared port sockets", () => {
    const html = renderNodeCard(shaderUniformCard);

    expect(html).toContain("IN");
    expect(html).toContain("OUT");
    expect(html).toContain("speed");
    expect(html).toContain("out");
    expect(html).toContain("port-socket");
  });

  it("renders empty inlet and outlet states for zero-port nodes", () => {
    const html = renderNodeCard(zeroPortCard);

    expect(html).toContain("No inlets");
    expect(html).toContain("No outlets");
  });

  it("renders a handle for every input and output port", () => {
    const html = renderNodeCard(multiPortCard);

    expect(countOccurrences(html, "port-socket")).toBe(multiPortCard.inputs.length + multiPortCard.outputs.length);
  });
});

function renderNodeCard(card: Parameters<typeof NodeCard>[0]): string {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      { theme },
      createElement(NodeCard, {
        ...card,
        renderInputHandle: renderHandle,
        renderOutputHandle: renderHandle
      })
    )
  );
}

function renderHandle(port: NodePortView, side: NodePortSide) {
  void side;
  return createElement(NodePortHandle, {
    color: port.color
  });
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}
