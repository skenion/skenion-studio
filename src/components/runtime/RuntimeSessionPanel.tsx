import { Badge, Button, Code, Group, Text } from "@mantine/core";
import { Play, Route, ShieldCheck, Trash2 } from "lucide-react";
import type { RuntimeSessionResponse } from "../../runtime/types";

export function RuntimeSessionPanel({
  busyAction,
  connected,
  onClearSession,
  onPlanSession,
  onRunSession,
  onValidateSession,
  session,
  sessionLoaded,
  sessionSynced
}: {
  busyAction: string | null;
  connected: boolean;
  onClearSession: () => void;
  onPlanSession: () => void;
  onRunSession: () => void;
  onValidateSession: () => void;
  session: RuntimeSessionResponse | null;
  sessionLoaded: boolean;
  sessionSynced: boolean;
}) {
  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          Session
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={sessionLoaded ? "green" : "gray"} radius="sm" variant="light">
            {sessionLoaded ? "loaded" : "empty"}
          </Badge>
          <Badge color={sessionSynced ? "green" : "yellow"} radius="sm" variant="light">
            {sessionSynced ? "synced" : "not synced"}
          </Badge>
        </Group>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected || !sessionLoaded} leftSection={<Route size={15} />} loading={busyAction === "planSession"} onClick={onPlanSession} radius="sm" size="xs" variant="light">
          Plan Session
        </Button>
        <Button disabled={!connected || !sessionLoaded} leftSection={<Play size={15} />} loading={busyAction === "runSession"} onClick={onRunSession} radius="sm" size="xs" variant="light">
          Run Session
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected || !sessionLoaded} leftSection={<ShieldCheck size={15} />} loading={busyAction === "validateSession"} onClick={onValidateSession} radius="sm" size="xs" variant="light">
          Validate Session
        </Button>
        <Button color="red" disabled={!connected || !sessionLoaded} leftSection={<Trash2 size={15} />} loading={busyAction === "clearSession"} onClick={onClearSession} radius="sm" size="xs" variant="light">
          Clear
        </Button>
      </Group>

      {session ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: session.graphId,
              graphRevision: session.graphRevision,
              sessionRevision: session.sessionRevision,
              controlRevision: session.controlRevision
            },
            null,
            2
          )}
        </Code>
      ) : null}
    </>
  );
}
