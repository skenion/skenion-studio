import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { DeferredNumberInput } from "./DeferredNumberInput";
import { IntegerValueControls } from "./IntegerValueControls";

describe("IntegerValueControls", () => {
  it("normalizes committed graph param edits to integers", () => {
    const changes: number[] = [];
    const element = IntegerValueControls({
      representation: "i32",
      value: 12,
      onChange: (value) => changes.push(value),
      onRepresentationChange: () => undefined
    });
    const input = findElementByType(element, DeferredNumberInput);
    if (!input?.props.normalize || !input.props.onCommit) {
      throw new Error("expected IntegerValueControls to render a DeferredNumberInput");
    }

    input.props.onCommit(input.props.normalize(33.8));

    expect(changes).toEqual([33]);
  });
});

function findElementByType(
  node: ReactNode,
  type: unknown
): ReactElement<{
  children?: ReactNode;
  normalize?: (value: number) => number;
  onCommit?: (value: number) => void;
  value?: unknown;
}> | null {
  if (!isValidElement(node)) {
    return null;
  }

  if (node.type === type) {
    return node as ReactElement<{
      children?: ReactNode;
      normalize?: (value: number) => number;
      onCommit?: (value: number) => void;
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
