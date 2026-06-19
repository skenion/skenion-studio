import { Button, Group, Stack, Text } from "@mantine/core";
import { Send, SlidersHorizontal, Zap } from "lucide-react";
import type {
  RuntimeControlEventRequest,
  RuntimeControlValue
} from "../../runtime/types";
import { bangControlMessage, controlMessageFromValue, setControlMessage } from "../../runtime/controlMessage";

export interface RuntimeControlValueControlsProps {
  availableActions?: {
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
  availableActions,
  busy,
  enabled,
  nodeId,
  onSend,
  value
}: RuntimeControlValueControlsProps) {
  const showSet = availableActions?.set ?? true;
  const showIn = availableActions?.in ?? true;
  const showBang = availableActions?.bang ?? true;

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
            onClick={() => onSend({ nodeId, portId: "in", message: setControlMessage(value) })}
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
            onClick={() => onSend({ nodeId, portId: "in", message: bangControlMessage() })}
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
