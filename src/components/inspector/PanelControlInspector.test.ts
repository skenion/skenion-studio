import { TextInput } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "../../graph/patchLibrary";
import { DeferredNumberInput } from "./DeferredNumberInput";
import { PanelControlInspector } from "./PanelControlInspector";
import { RoutingNodeControls } from "./RoutingNodeControls";

describe("PanelControlInspector", () => {
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

  it("commits slider graph params through deferred numeric inputs", () => {
    const patched: unknown[] = [];
    const element = PanelControlInspector({
      node: node("core.float", { label: "Level", max: 1, min: 0, step: 0.1, value: 0.5, widget: "slider" }),
      onSetNodeParam: (...args) => patched.push(args)
    });
    const inputs = findElementsByType(element, DeferredNumberInput);

    expect(inputs).toHaveLength(4);
    inputs[0]?.props.onCommit?.(0.8);

    expect(patched).toEqual([["node_1", "value", 0.8]]);
  });

  it("edits bang radius as a graph param", () => {
    const patched: unknown[] = [];
    const element = PanelControlInspector({
      node: node("core.bang", { label: "Bang", radius: "50%" }),
      onSetNodeParam: (...args) => patched.push(args)
    });
    const inputs = findElementsByType(element, TextInput);

    inputs[1]?.props.onChange?.({ currentTarget: { value: "0" } });

    expect(patched).toEqual([["node_1", "radius", "0"]]);
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
): ReactElement<{
  children?: ReactNode;
  onChange?: (event: { currentTarget: { checked?: boolean; value?: string } }) => void;
  onClick?: () => void;
  onCommit?: (value: number) => void;
}>[] {
  if (!isValidElement(node)) {
    return [];
  }

  if (typeof node.type === "function" && node.type.name === "SliderGraphParams") {
    const renderComponent = node.type as unknown as (props: unknown) => ReactNode;
    const rendered = renderComponent(node.props);
    return findElementsByType(rendered, type);
  }

  if (typeof node.type === "function" && node.type.name === "BangGraphParams") {
    const renderComponent = node.type as unknown as (props: unknown) => ReactNode;
    const rendered = renderComponent(node.props);
    return findElementsByType(rendered, type);
  }

  const current =
    node.type === type
      ? [
          node as ReactElement<{
            children?: ReactNode;
            onChange?: (event: { currentTarget: { checked?: boolean; value?: string } }) => void;
            onClick?: () => void;
            onCommit?: (value: number) => void;
          }>
        ]
      : [];
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    return [...current, ...children.flatMap((child) => findElementsByType(child, type))];
  }

  return [...current, ...findElementsByType(children, type)];
}
