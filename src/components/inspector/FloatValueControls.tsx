import { NumberInput, Stack, Text } from "@mantine/core";

export interface FloatValueControlsProps {
  value: number;
  onChange: (value: number) => void;
}

export function FloatValueControls({ onChange, value }: FloatValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Float Value
      </Text>
      <NumberInput
        decimalScale={3}
        label="Value"
        max={1}
        min={0}
        onChange={(nextValue) => {
          if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
            return;
          }
          onChange(nextValue);
        }}
        size="xs"
        step={0.01}
        value={value}
      />
    </Stack>
  );
}
