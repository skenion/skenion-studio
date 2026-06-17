import { Group, NumberInput, Stack, Text } from "@mantine/core";
import type { RgbaColor } from "../../graph/colorRgba";

export interface ColorRgbaControlsProps {
  color: RgbaColor;
  onChange: (color: RgbaColor) => void;
}

export function ColorRgbaControls({ color, onChange }: ColorRgbaControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        RGBA Color
      </Text>
      <Group grow>
        {(["R", "G", "B", "A"] as const).map((label, index) => (
          <NumberInput
            decimalScale={3}
            key={label}
            label={label}
            max={1}
            min={0}
            onChange={(value) => {
              if (typeof value !== "number" || !Number.isFinite(value)) {
                return;
              }
              const nextColor = [...color] as RgbaColor;
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
