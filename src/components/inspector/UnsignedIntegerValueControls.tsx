import { Select, Stack, Text } from "@mantine/core";
import { UINT_REPRESENTATIONS, type UIntRepresentation } from "../../graph/uintValue";
import { DeferredNumberInput } from "./DeferredNumberInput";

export interface UnsignedIntegerValueControlsProps {
  representation: UIntRepresentation;
  value: number;
  onChange: (value: number) => void;
  onRepresentationChange: (representation: UIntRepresentation) => void;
}

export function UnsignedIntegerValueControls({
  onChange,
  onRepresentationChange,
  representation,
  value
}: UnsignedIntegerValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        UInt Graph Param
      </Text>
      <Select
        allowDeselect={false}
        data={[...UINT_REPRESENTATIONS]}
        label="Representation"
        onChange={(nextValue) => {
          if (nextValue && UINT_REPRESENTATIONS.includes(nextValue as UIntRepresentation)) {
            onRepresentationChange(nextValue as UIntRepresentation);
          }
        }}
        size="xs"
        value={representation}
      />
      <DeferredNumberInput
        allowDecimal={false}
        label="Value"
        min={0}
        normalize={(nextValue) => Math.max(0, Math.trunc(nextValue))}
        onCommit={onChange}
        size="xs"
        step={1}
        value={value}
      />
    </Stack>
  );
}
