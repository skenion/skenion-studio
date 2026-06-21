import { Group, Stack, Text } from "@mantine/core";
import { DeferredNumberInput } from "./DeferredNumberInput";

export interface ClearColorControlsProps {
  color: [number, number, number, number];
  onChange: (color: [number, number, number, number]) => void;
}

export function ClearColorControls({ color, onChange }: ClearColorControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Clear Color
      </Text>
      <Group grow>
        {(["R", "G", "B", "A"] as const).map((label, index) => (
          <DeferredNumberInput
            decimalScale={3}
            key={label}
            label={label}
            max={1}
            min={0}
            normalize={clampColorComponent}
            onCommit={(value) => {
              const nextColor = [...color] as [number, number, number, number];
              nextColor[index] = value;
              onChange(nextColor);
            }}
            size="xs"
            step={0.01}
            value={color[index]}
          />
        ))}
      </Group>
    </Stack>
  );
}

function clampColorComponent(value: number) {
  return Math.min(1, Math.max(0, value));
}
