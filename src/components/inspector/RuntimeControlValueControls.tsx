import { Button, Group, Stack, Text } from "@mantine/core";
import { Send, SlidersHorizontal, Zap } from "lucide-react";
import type {
  RuntimeControlEventRequest,
  RuntimeControlValue
} from "../../runtime/types";

export interface RuntimeControlValueControlsProps {
  busy: boolean;
  enabled: boolean;
  nodeId: string;
  value: RuntimeControlValue;
  onSend: (request: RuntimeControlEventRequest) => void;
}

export function RuntimeControlValueControls({
  busy,
  enabled,
  nodeId,
  onSend,
  value
}: RuntimeControlValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Runtime Control
      </Text>
      <Group gap="xs" grow>
        <Button
          disabled={!enabled}
          leftSection={<SlidersHorizontal size={14} />}
          loading={busy}
          onClick={() => onSend({ nodeId, portId: "set", value })}
          radius="sm"
          size="xs"
          variant="light"
        >
          Set
        </Button>
        <Button
          disabled={!enabled}
          leftSection={<Send size={14} />}
          loading={busy}
          onClick={() => onSend({ nodeId, portId: "in", value })}
          radius="sm"
          size="xs"
          variant="light"
        >
          In
        </Button>
        <Button
          disabled={!enabled}
          leftSection={<Zap size={14} />}
          loading={busy}
          onClick={() => onSend({ nodeId, portId: "bang", value: { type: "bang" } })}
          radius="sm"
          size="xs"
          variant="light"
        >
          Bang
        </Button>
      </Group>
    </Stack>
  );
}
