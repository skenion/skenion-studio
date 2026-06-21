import { Select, Stack, Text } from "@mantine/core";
import { INT_REPRESENTATIONS, type IntRepresentation } from "../../graph/intValue";
import { DeferredNumberInput } from "./DeferredNumberInput";

export interface IntegerValueControlsProps {
  representation: IntRepresentation;
  value: number;
  onChange: (value: number) => void;
  onRepresentationChange: (representation: IntRepresentation) => void;
}

export function IntegerValueControls({
  onChange,
  onRepresentationChange,
  representation,
  value
}: IntegerValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Int Graph Param
      </Text>
      <Select
        allowDeselect={false}
        data={[...INT_REPRESENTATIONS]}
        label="Representation"
        onChange={(nextValue) => {
          if (nextValue && INT_REPRESENTATIONS.includes(nextValue as IntRepresentation)) {
            onRepresentationChange(nextValue as IntRepresentation);
          }
        }}
        size="xs"
        value={representation}
      />
      <DeferredNumberInput
        allowDecimal={false}
        label="Value"
        normalize={Math.trunc}
        onCommit={onChange}
        size="xs"
        step={1}
        value={value}
      />
    </Stack>
  );
}
