import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { DeferredNumberInput } from "./DeferredNumberInput";
import { FloatValueControls } from "./FloatValueControls";

describe("FloatValueControls", () => {
  it("commits numeric graph param edits through deferred input", () => {
    const changes: number[] = [];
    const element = FloatValueControls({
      representation: "f32",
      value: 0.2,
      onChange: (value) => changes.push(value),
      onRepresentationChange: () => undefined
    });
    const input = findElementByType(element, DeferredNumberInput);
    if (!input?.props.onCommit) {
      throw new Error("expected FloatValueControls to render a DeferredNumberInput");
    }

    expect(input.props.value).toBe(0.2);
    input.props.onCommit(0.8);

    expect(changes).toEqual([0.8]);
  });
});

function findElementByType(
  node: ReactNode,
  type: unknown
): ReactElement<{ children?: ReactNode; onCommit?: (value: number) => void; value?: unknown }> | null {
  if (!isValidElement(node)) {
    return null;
  }

  if (node.type === type) {
    return node as ReactElement<{ children?: ReactNode; onCommit?: (value: number) => void; value?: unknown }>;
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
