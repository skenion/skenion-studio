import { Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import {
  COLOR_REPRESENTATIONS,
  COLOR_SPACES,
  type ColorRepresentation,
  type ColorSpace,
  type RgbaColor
} from "../../graph/colorRgba";

export interface ColorRgbaControlsProps {
  color: RgbaColor;
  colorSpace: ColorSpace;
  representation: ColorRepresentation;
  onChange: (color: RgbaColor) => void;
  onColorSpaceChange: (colorSpace: ColorSpace) => void;
  onRepresentationChange: (representation: ColorRepresentation) => void;
}

export function ColorRgbaControls({
  color,
  colorSpace,
  onChange,
  onColorSpaceChange,
  onRepresentationChange,
  representation
}: ColorRgbaControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Color
      </Text>
      <Group grow>
        <Select
          allowDeselect={false}
          data={[...COLOR_REPRESENTATIONS]}
          label="Representation"
          onChange={(nextValue) => {
            if (nextValue && COLOR_REPRESENTATIONS.includes(nextValue as ColorRepresentation)) {
              onRepresentationChange(nextValue as ColorRepresentation);
            }
          }}
          size="xs"
          value={representation}
        />
        <Select
          allowDeselect={false}
          data={[...COLOR_SPACES]}
          label="Color Space"
          onChange={(nextValue) => {
            if (nextValue && COLOR_SPACES.includes(nextValue as ColorSpace)) {
              onColorSpaceChange(nextValue as ColorSpace);
            }
          }}
          size="xs"
          value={colorSpace}
        />
      </Group>
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
