import { Badge, Button, Group, Text, TextInput } from "@mantine/core";
import { Cable, RefreshCw } from "lucide-react";
import type { RuntimeConnectionStatus } from "../../runtime/types";

export function RuntimeConnectionPanel({
  busyAction,
  connected,
  onConnect,
  onRefreshSession,
  onUrlChange,
  status,
  url
}: {
  busyAction: string | null;
  connected: boolean;
  onConnect: () => void;
  onRefreshSession: () => void;
  onUrlChange: (url: string) => void;
  status: RuntimeConnectionStatus;
  url: string;
}) {
  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800} size="sm">
            Runtime
          </Text>
          <Text c="dimmed" size="xs">
            Local HTTP control
          </Text>
        </div>
        <Badge color={statusColor(status)} radius="sm" variant="light">
          {status}
        </Badge>
      </Group>

      <Text c="dimmed" size="xs">
        Connection
      </Text>
      <TextInput
        aria-label="Runtime URL"
        disabled={busyAction !== null}
        onChange={(event) => onUrlChange(event.currentTarget.value)}
        radius="sm"
        size="xs"
        value={url}
      />
      <Group gap="xs" grow>
        <Button
          leftSection={<Cable size={15} />}
          loading={busyAction === "connect"}
          onClick={onConnect}
          radius="sm"
          size="xs"
          variant={connected ? "light" : "filled"}
        >
          Connect
        </Button>
        <Button
          disabled={!connected}
          leftSection={<RefreshCw size={15} />}
          loading={busyAction === "session"}
          onClick={onRefreshSession}
          radius="sm"
          size="xs"
          variant="light"
        >
          Refresh
        </Button>
      </Group>
    </>
  );
}

function statusColor(status: RuntimeConnectionStatus): string {
  switch (status) {
    case "connected":
      return "green";
    case "connecting":
      return "blue";
    case "error":
      return "red";
    case "disconnected":
      return "gray";
  }
}
