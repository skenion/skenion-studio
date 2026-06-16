import { Badge, Button, Code, Group, Stack, Text } from "@mantine/core";
import { History, Redo2, Undo2 } from "lucide-react";
import type { GraphPatchEventV01, GraphPatchHistoryV01 } from "@skenion/contracts";
import type { RuntimeHistoryActionAvailability } from "../../runtime/historySync";

interface RuntimeHistoryPanelProps {
  busyAction: string | null;
  connected: boolean;
  history: GraphPatchHistoryV01 | null;
  historyAvailability: RuntimeHistoryActionAvailability;
  latestEvents: GraphPatchEventV01[];
  sessionLoaded: boolean;
  onRedoPatch: () => void;
  onRefreshHistory: () => void;
  onUndoPatch: () => void;
}

export function RuntimeHistoryPanel({
  busyAction,
  connected,
  history,
  historyAvailability,
  latestEvents,
  sessionLoaded,
  onRedoPatch,
  onRefreshHistory,
  onUndoPatch
}: RuntimeHistoryPanelProps) {
  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          History
        </Text>
        <Badge color={history ? "blue" : "gray"} radius="sm" variant="light">
          {history ? `${history.events.length} events` : "unavailable"}
        </Badge>
      </Group>

      <Code block className="runtime-json">
        {JSON.stringify(
          {
            canUndo: history?.canUndo ?? false,
            canRedo: history?.canRedo ?? false,
            undoDepth: history?.undoDepth ?? 0,
            redoDepth: history?.redoDepth ?? 0,
            blocked: historyAvailability.reason
          },
          null,
          2
        )}
      </Code>

      <Group gap="xs" grow>
        <Button
          disabled={!connected || !sessionLoaded}
          leftSection={<History size={15} />}
          loading={busyAction === "refreshHistory"}
          onClick={onRefreshHistory}
          radius="sm"
          size="xs"
          variant="light"
        >
          Refresh History
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button
          disabled={!historyAvailability.canUndo}
          leftSection={<Undo2 size={15} />}
          loading={busyAction === "undoPatch"}
          onClick={onUndoPatch}
          radius="sm"
          size="xs"
          variant="light"
        >
          Undo
        </Button>
        <Button
          disabled={!historyAvailability.canRedo}
          leftSection={<Redo2 size={15} />}
          loading={busyAction === "redoPatch"}
          onClick={onRedoPatch}
          radius="sm"
          size="xs"
          variant="light"
        >
          Redo
        </Button>
      </Group>

      {latestEvents.length > 0 ? (
        <Stack gap={4}>
          {latestEvents.map((event) => (
            <Code block className="runtime-json" key={event.id}>
              {JSON.stringify(
                {
                  id: event.id,
                  kind: event.kind,
                  revision: `${event.revisionBefore} -> ${event.revisionAfter}`,
                  ops: event.patch.ops.length
                },
                null,
                2
              )}
            </Code>
          ))}
        </Stack>
      ) : null}
    </>
  );
}
