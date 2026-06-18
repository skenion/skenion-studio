import { Button, Group, Stack, Text } from "@mantine/core";
import { Send, SlidersHorizontal, Zap } from "lucide-react";
import type {
  RuntimeControlEventRequest,
  RuntimeControlValue
} from "../../runtime/types";
import { bangControlMessage, controlMessageFromValue, setControlMessage } from "../../runtime/controlMessage";

export interface RuntimeControlValueControlsProps {
  availablePorts?: {
    in?: boolean;
    set?: boolean;
    bang?: boolean;
  };
  busy: boolean;
  enabled: boolean;
  nodeId: string;
  value: RuntimeControlValue;
  onSend: (request: RuntimeControlEventRequest) => void;
}

export function RuntimeControlValueControls({
  availablePorts,
  busy,
  enabled,
  nodeId,
  onSend,
  value
}: RuntimeControlValueControlsProps) {
  const showSet = availablePorts?.set ?? true;
  const showIn = availablePorts?.in ?? true;
  const showBang = availablePorts?.bang ?? true;

  if (!showSet && !showIn && !showBang) {
    return null;
  }

  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Runtime Control
      </Text>
      <Group gap="xs" grow>
        {showSet ? (
          <Button
            disabled={!enabled}
            leftSection={<SlidersHorizontal size={14} />}
            loading={busy}
            onClick={() => onSend({ nodeId, portId: "set", message: setControlMessage(value) })}
            radius="sm"
            size="xs"
            variant="light"
          >
            Set
          </Button>
        ) : null}
        {showIn ? (
          <Button
            disabled={!enabled}
            leftSection={<Send size={14} />}
            loading={busy}
            onClick={() => onSend({ nodeId, portId: "in", message: controlMessageFromValue(value) })}
            radius="sm"
            size="xs"
            variant="light"
          >
            In
          </Button>
        ) : null}
        {showBang ? (
          <Button
            disabled={!enabled}
            leftSection={<Zap size={14} />}
            loading={busy}
            onClick={() => onSend({ nodeId, portId: "bang", message: bangControlMessage() })}
            radius="sm"
            size="xs"
            variant="light"
          >
            Bang
          </Button>
        ) : null}
      </Group>
    </Stack>
  );
}
