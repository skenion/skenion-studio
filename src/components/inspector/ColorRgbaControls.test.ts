import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { DeferredNumberInput } from "./DeferredNumberInput";
import { ColorRgbaControls } from "./ColorRgbaControls";

describe("ColorRgbaControls", () => {
  it("commits clamped numeric component edits through deferred inputs", () => {
    const changes: unknown[] = [];
    const element = ColorRgbaControls({
      color: [0.1, 0.2, 0.3, 1],
      colorSpace: "linear",
      representation: "rgba32f",
      onChange: (color) => changes.push(color),
      onColorSpaceChange: () => undefined,
      onRepresentationChange: () => undefined
    });
    const inputs = findElementsByType(element, DeferredNumberInput);

    expect(inputs).toHaveLength(4);
    expect(inputs[0]?.props.value).toBe(0.1);
    inputs[0]?.props.onCommit?.(inputs[0].props.normalize?.(1.8) ?? 1.8);

    expect(changes).toEqual([[1, 0.2, 0.3, 1]]);
  });
});

function findElementsByType(
  node: ReactNode,
  type: unknown
): ReactElement<{
  children?: ReactNode;
  normalize?: (value: number) => number;
  onCommit?: (value: number) => void;
  value?: unknown;
}>[] {
  if (!isValidElement(node)) {
    return [];
  }

  const current =
    node.type === type
      ? [
          node as ReactElement<{
            children?: ReactNode;
            normalize?: (value: number) => number;
            onCommit?: (value: number) => void;
            value?: unknown;
          }>
        ]
      : [];
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    return [...current, ...children.flatMap((child) => findElementsByType(child, type))];
  }

  return [...current, ...findElementsByType(children, type)];
}
