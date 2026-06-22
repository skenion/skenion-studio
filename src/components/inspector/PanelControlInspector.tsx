import { Group, Stack, Switch, Text, TextInput } from "@mantine/core";
import type { DisplayGraphNodeV01 } from "../../graph/patchLibrary";
import {
  isBangControlNode,
  isSliderFloatNode,
  isToggleControlNode,
  readBangParams,
  readPanelLabelParam,
  readSliderFloatParams,
  readToggleControlValue
} from "../../graph/panelControls";
import { DeferredNumberInput } from "./DeferredNumberInput";

export interface PanelControlInspectorProps {
  node: DisplayGraphNodeV01;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}

export function PanelControlInspector({
  node,
  onSetNodeParam
}: PanelControlInspectorProps) {
  if (!isBangControlNode(node) && !isSliderFloatNode(node) && !isToggleControlNode(node)) {
    return null;
  }

  return (
    <Stack gap="sm">
      <Stack gap="xs">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Panel Graph Params
        </Text>
        <TextInput
          label="Label"
          onChange={(event) => onSetNodeParam(node.id, "label", event.currentTarget.value)}
          size="xs"
          value={readPanelLabelParam(node)}
        />
        {isBangControlNode(node) ? <BangGraphParams node={node} onSetNodeParam={onSetNodeParam} /> : null}
        {isSliderFloatNode(node) ? <SliderGraphParams node={node} onSetNodeParam={onSetNodeParam} /> : null}
        {isToggleControlNode(node) ? (
          <Switch
            checked={readToggleControlValue(node)}
            label="Initial value"
            onChange={(event) => onSetNodeParam(node.id, "value", event.currentTarget.checked)}
            size="sm"
          />
        ) : null}
      </Stack>
    </Stack>
  );
}

function BangGraphParams({
  node,
  onSetNodeParam
}: {
  node: DisplayGraphNodeV01;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}) {
  const params = readBangParams(node);
  return (
    <TextInput
      label="Radius"
      onChange={(event) => onSetNodeParam(node.id, "radius", event.currentTarget.value)}
      size="xs"
      value={params.radius}
    />
  );
}

function SliderGraphParams({
  node,
  onSetNodeParam
}: {
  node: DisplayGraphNodeV01;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}) {
  const params = readSliderFloatParams(node);
  return (
    <Group gap="xs" grow>
      {(["value", "min", "max", "step"] as const).map((key) => (
        <DeferredNumberInput
          decimalScale={3}
          key={key}
          label={key}
          onCommit={(nextValue) => onSetNodeParam(node.id, key, nextValue)}
          size="xs"
          step={key === "step" ? 0.01 : 0.1}
          value={params[key]}
        />
      ))}
    </Group>
  );
}
