import { NumberInput, Stack, Text } from "@mantine/core";

export interface IntegerValueControlsProps {
  value: number;
  onChange: (value: number) => void;
}

export function IntegerValueControls({ onChange, value }: IntegerValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        I32 Graph Param
      </Text>
      <NumberInput
        allowDecimal={false}
        label="Value"
        onChange={(nextValue) => {
          if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
            return;
          }
          onChange(Math.trunc(nextValue));
        }}
        size="xs"
        step={1}
        value={value}
      />
    </Stack>
  );
}
