import { Button, Divider, Group, NumberInput, Slider, Stack, Switch, Text, TextInput } from "@mantine/core";
import { MousePointerClick, Send } from "lucide-react";
import { useState } from "react";
import type { GraphNodeV01 } from "@skenion/contracts";
import type { RuntimeControlEventRequest } from "../../runtime/types";
import { bangControlMessage, controlMessageFromValue } from "../../runtime/controlMessage";
import {
  isBangControlNode,
  isSliderFloatNode,
  isToggleControlNode,
  readPanelLabelParam,
  readSliderFloatParams,
  readToggleControlValue
} from "../../graph/panelControls";

export interface PanelControlInspectorProps {
  busy: boolean;
  enabled: boolean;
  node: GraphNodeV01;
  onSend: (request: RuntimeControlEventRequest) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}

export function PanelControlInspector({
  busy,
  enabled,
  node,
  onSend,
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
      <Divider />
      {isBangControlNode(node) ? (
        <Button
          disabled={!enabled}
          leftSection={<MousePointerClick size={14} />}
          loading={busy}
          onClick={() => onSend({ nodeId: node.id, portId: "in", message: bangControlMessage() })}
          radius="sm"
          size="xs"
          variant="light"
        >
          Bang
        </Button>
      ) : null}
      {isSliderFloatNode(node) ? (
        <RuntimeSlider node={node} busy={busy} enabled={enabled} onSend={onSend} />
      ) : null}
      {isToggleControlNode(node) ? (
        <RuntimeToggle node={node} busy={busy} enabled={enabled} onSend={onSend} />
      ) : null}
    </Stack>
  );
}

function SliderGraphParams({
  node,
  onSetNodeParam
}: {
  node: GraphNodeV01;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}) {
  const params = readSliderFloatParams(node);
  return (
    <Group gap="xs" grow>
      {(["value", "min", "max", "step"] as const).map((key) => (
        <NumberInput
          decimalScale={3}
          key={key}
          label={key}
          onChange={(nextValue) => {
            if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
              return;
            }
            onSetNodeParam(node.id, key, nextValue);
          }}
          size="xs"
          step={key === "step" ? 0.01 : 0.1}
          value={params[key]}
        />
      ))}
    </Group>
  );
}

function RuntimeSlider({
  busy,
  enabled,
  node,
  onSend
}: {
  busy: boolean;
  enabled: boolean;
  node: GraphNodeV01;
  onSend: (request: RuntimeControlEventRequest) => void;
}) {
  const params = readSliderFloatParams(node);
  const [value, setValue] = useState(params.value);
  const sendValue = (nextValue: number) => onSend(sliderRuntimeRequest(node.id, nextValue));

  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Runtime Control
      </Text>
      <Slider
        disabled={!enabled || busy}
        label={(nextValue) => nextValue.toFixed(2)}
        max={params.max}
        min={params.min}
        onChange={(nextValue) => {
          setValue(nextValue);
          sendValue(nextValue);
        }}
        step={params.step}
        value={value}
      />
      <Button
        disabled={!enabled}
        leftSection={<Send size={14} />}
        loading={busy}
        onClick={() => sendValue(value)}
        radius="sm"
        size="xs"
        variant="light"
      >
        Emit {params.label}
      </Button>
    </Stack>
  );
}

function RuntimeToggle({
  busy,
  enabled,
  node,
  onSend
}: {
  busy: boolean;
  enabled: boolean;
  node: GraphNodeV01;
  onSend: (request: RuntimeControlEventRequest) => void;
}) {
  const [checked, setChecked] = useState(readToggleControlValue(node));
  return (
    <Switch
      checked={checked}
      disabled={!enabled || busy}
      label="Runtime value"
      onChange={(event) => {
        const next = event.currentTarget.checked;
        setChecked(next);
        onSend(toggleRuntimeRequest(node.id));
      }}
      size="sm"
    />
  );
}

export function sliderRuntimeRequest(nodeId: string, value: number): RuntimeControlEventRequest {
  return {
    nodeId,
    portId: "in",
    message: controlMessageFromValue({
      type: "float",
      representation: "f32",
      value
    })
  };
}

export function toggleRuntimeRequest(nodeId: string): RuntimeControlEventRequest {
  return {
    nodeId,
    portId: "in",
    message: bangControlMessage()
  };
}
