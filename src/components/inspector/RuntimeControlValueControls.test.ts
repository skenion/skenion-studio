import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Button } from "@mantine/core";
import { RuntimeControlValueControls } from "./RuntimeControlValueControls";

describe("RuntimeControlValueControls", () => {
  it("emits set, in, and bang runtime control requests without graph patch callbacks", () => {
    const requests: unknown[] = [];
    const element = RuntimeControlValueControls({
      busy: false,
      enabled: true,
      nodeId: "value_1",
      onSend: (request) => requests.push(request),
      value: { type: "float", representation: "f32", value: 1.25 }
    });
    const buttons = findElementsByType(element, Button);

    expect(buttons).toHaveLength(3);
    buttons[0]?.props.onClick?.();
    buttons[1]?.props.onClick?.();
    buttons[2]?.props.onClick?.();

    expect(requests).toEqual([
      { nodeId: "value_1", portId: "set", message: { selector: "set", atoms: [{ type: "float", representation: "f32", value: 1.25 }] } },
      { nodeId: "value_1", portId: "in", message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] } },
      { nodeId: "value_1", portId: "bang", message: { selector: "bang", atoms: [] } }
    ]);
  });

  it("renders disabled controls when runtime control is unavailable", () => {
    const element = RuntimeControlValueControls({
      busy: false,
      enabled: false,
      nodeId: "value_1",
      onSend: () => undefined,
      value: { type: "bool", value: true }
    });
    const buttons = findElementsByType(element, Button);

    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.props.disabled === true)).toBe(true);
  });

  it("renders only available runtime input ports", () => {
    const requests: unknown[] = [];
    const element = RuntimeControlValueControls({
      availablePorts: { bang: true, in: false, set: false },
      busy: false,
      enabled: true,
      nodeId: "message_1",
      onSend: (request) => requests.push(request),
      value: { type: "string", value: "perform" }
    });
    const buttons = findElementsByType(element, Button);

    expect(buttons).toHaveLength(1);
    buttons[0]?.props.onClick?.();
    expect(requests).toEqual([{ nodeId: "message_1", portId: "bang", message: { selector: "bang", atoms: [] } }]);
  });

  it("returns null when no runtime input ports are available", () => {
    expect(
      RuntimeControlValueControls({
        availablePorts: { bang: false, in: false, set: false },
        busy: false,
        enabled: true,
        nodeId: "comment_1",
        onSend: () => undefined,
        value: { type: "string", value: "" }
      })
    ).toBeNull();
  });
});

function findElementsByType(
  node: ReactNode,
  type: unknown
): ReactElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>[] {
  if (!isValidElement(node)) {
    return [];
  }

  const current =
    node.type === type
      ? [node as ReactElement<{ children?: ReactNode; disabled?: boolean; onClick?: () => void }>]
      : [];
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    return [...current, ...children.flatMap((child) => findElementsByType(child, type))];
  }

  return [...current, ...findElementsByType(children, type)];
}
