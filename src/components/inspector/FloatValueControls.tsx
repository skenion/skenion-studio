import { Select, Stack, Text } from "@mantine/core";
import { FLOAT_REPRESENTATIONS, type FloatRepresentation } from "../../graph/floatValue";
import { DeferredNumberInput } from "./DeferredNumberInput";

export interface FloatValueControlsProps {
  representation: FloatRepresentation;
  value: number;
  onChange: (value: number) => void;
  onRepresentationChange: (representation: FloatRepresentation) => void;
}

export function FloatValueControls({
  onChange,
  onRepresentationChange,
  representation,
  value
}: FloatValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Float Graph Param
      </Text>
      <Select
        allowDeselect={false}
        data={[...FLOAT_REPRESENTATIONS]}
        label="Representation"
        onChange={(nextValue) => {
          if (nextValue && FLOAT_REPRESENTATIONS.includes(nextValue as FloatRepresentation)) {
            onRepresentationChange(nextValue as FloatRepresentation);
          }
        }}
        size="xs"
        value={representation}
      />
      <DeferredNumberInput
        decimalScale={3}
        label="Value"
        onCommit={onChange}
        size="xs"
        step={0.1}
        value={value}
      />
    </Stack>
  );
}
