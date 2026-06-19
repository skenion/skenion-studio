import { TextInput } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { GraphNodeV01 } from "@skenion/contracts";
import { sliderRuntimeRequest, toggleRuntimeRequest } from "./PanelControlInspector";
import { RoutingNodeControls } from "./RoutingNodeControls";

describe("PanelControlInspector", () => {
  it("creates slider runtime value events without graph param edits", () => {
    expect(sliderRuntimeRequest("node_1", 1.25)).toEqual({
      nodeId: "node_1",
      portId: "in",
      message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] }
    });
  });

  it("creates toggle runtime bang events without graph param edits", () => {
    expect(toggleRuntimeRequest("node_1")).toEqual({
      nodeId: "node_1",
      portId: "in",
      message: { selector: "bang", atoms: [] }
    });
  });

  it("edits object routing names as graph params", () => {
    const patched: unknown[] = [];
    const element = RoutingNodeControls({
      node: node("core.float", { sendName: "speed", receiveName: "", widget: "slider" }),
      onSetNodeParam: (...args) => patched.push(args)
    });
    const inputs = findElementsByType(element, TextInput);

    inputs[0]?.props.onChange?.({ currentTarget: { value: "phase" } });

    expect(patched).toEqual([["node_1", "sendName", "phase"]]);
  });
});

function node(kind: string, params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "node_1",
    kind,
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}

function findElementsByType(
  node: ReactNode,
  type: unknown
): ReactElement<{ children?: ReactNode; onChange?: (event: { currentTarget: { checked?: boolean; value?: string } }) => void; onClick?: () => void }>[] {
  if (!isValidElement(node)) {
    return [];
  }

  const current =
    node.type === type
      ? [node as ReactElement<{ children?: ReactNode; onChange?: (event: { currentTarget: { checked?: boolean; value?: string } }) => void; onClick?: () => void }>]
      : [];
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    return [...current, ...children.flatMap((child) => findElementsByType(child, type))];
  }

  return [...current, ...findElementsByType(children, type)];
}
