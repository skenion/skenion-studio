import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { Switch } from "@mantine/core";
import { BooleanValueControls } from "./BooleanValueControls";

describe("BooleanValueControls", () => {
  it("emits switch checked state changes", () => {
    const changes: boolean[] = [];
    const element = BooleanValueControls({
      value: false,
      onChange: (value) => changes.push(value)
    });
    const input = findElementByType(element, Switch);
    if (!input?.props.onChange) {
      throw new Error("expected BooleanValueControls to render a Switch");
    }

    input.props.onChange({ currentTarget: { checked: true } });

    expect(changes).toEqual([true]);
  });
});

function findElementByType(
  node: ReactNode,
  type: unknown
): ReactElement<{
  children?: ReactNode;
  onChange?: (event: { currentTarget: { checked: boolean } }) => void;
  value?: unknown;
}> | null {
  if (!isValidElement(node)) {
    return null;
  }

  if (node.type === type) {
    return node as ReactElement<{
      children?: ReactNode;
      onChange?: (event: { currentTarget: { checked: boolean } }) => void;
      value?: unknown;
    }>;
  }

  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElementByType(child, type);
      if (found) {
        return found;
      }
    }
    return null;
  }

  return findElementByType(children, type);
}
