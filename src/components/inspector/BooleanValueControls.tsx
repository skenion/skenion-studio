import { Stack, Switch, Text } from "@mantine/core";

export interface BooleanValueControlsProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanValueControls({ onChange, value }: BooleanValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Boolean Graph Param
      </Text>
      <Switch
        checked={value}
        label="Value"
        onChange={(event) => onChange(event.currentTarget.checked)}
        size="sm"
      />
    </Stack>
  );
}
