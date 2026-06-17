import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { NumberInput } from "@mantine/core";
import { IntegerValueControls } from "./IntegerValueControls";

describe("IntegerValueControls", () => {
  it("emits truncated finite integer value changes only", () => {
    const changes: number[] = [];
    const element = IntegerValueControls({
      value: 12,
      onChange: (value) => changes.push(value)
    });
    const input = findElementByType(element, NumberInput);
    if (!input?.props.onChange) {
      throw new Error("expected IntegerValueControls to render a NumberInput");
    }

    input.props.onChange(33.8);
    input.props.onChange("34");
    input.props.onChange(Number.NaN);

    expect(changes).toEqual([33]);
  });
});

function findElementByType(
  node: ReactNode,
  type: unknown
): ReactElement<{ children?: ReactNode; onChange?: (value: unknown) => void; value?: unknown }> | null {
  if (!isValidElement(node)) {
    return null;
  }

  if (node.type === type) {
    return node as ReactElement<{ children?: ReactNode; onChange?: (value: unknown) => void; value?: unknown }>;
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
