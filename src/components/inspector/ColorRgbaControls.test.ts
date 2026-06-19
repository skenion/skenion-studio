import { NumberInput } from "@mantine/core";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ColorRgbaControls } from "./ColorRgbaControls";

describe("ColorRgbaControls", () => {
  it("emits finite numeric component changes only", () => {
    const changes: unknown[] = [];
    const element = ColorRgbaControls({
      color: [0.1, 0.2, 0.3, 1],
      colorSpace: "linear",
      representation: "rgba32f",
      onChange: (color) => changes.push(color),
      onColorSpaceChange: () => undefined,
      onRepresentationChange: () => undefined
    });
    const inputs = findElementsByType(element, NumberInput);

    expect(inputs).toHaveLength(4);
    expect(inputs[0]?.props.value).toBe(0.1);
    inputs[0]?.props.onChange?.(0.8);
    inputs[1]?.props.onChange?.("0.9");
    inputs[2]?.props.onChange?.(Number.NaN);

    expect(changes).toEqual([[0.8, 0.2, 0.3, 1]]);
  });
});

function findElementsByType(
  node: ReactNode,
  type: unknown
): ReactElement<{ children?: ReactNode; onChange?: (value: unknown) => void; value?: unknown }>[] {
  if (!isValidElement(node)) {
    return [];
  }

  const current =
    node.type === type
      ? [node as ReactElement<{ children?: ReactNode; onChange?: (value: unknown) => void; value?: unknown }>]
      : [];
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    return [...current, ...children.flatMap((child) => findElementsByType(child, type))];
  }

  return [...current, ...findElementsByType(children, type)];
}
