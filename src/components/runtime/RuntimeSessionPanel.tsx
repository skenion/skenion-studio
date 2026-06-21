import { Badge, Code, Group, Text } from "@mantine/core";
import { Play, Route, ShieldCheck, Trash2 } from "lucide-react";
import type { RuntimeSessionResponse } from "../../runtime/types";
import { Button } from "../core/Button/Button";

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
          <Badge color={sessionLoaded ? "green" : "gray"} variant="light">
            {sessionLoaded ? "loaded" : "empty"}
          </Badge>
          <Badge color={sessionSynced ? "green" : "yellow"} variant="light">
            {sessionSynced ? "synced" : "not synced"}
          </Badge>
        </Group>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected || !sessionLoaded} leftSection={<Route size={15} />} loading={busyAction === "planSession"} onClick={onPlanSession} size="xs" variant="light">
          Plan Session
        </Button>
        <Button disabled={!connected || !sessionLoaded} leftSection={<Play size={15} />} loading={busyAction === "runSession"} onClick={onRunSession} size="xs" variant="light">
          Run Session
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected || !sessionLoaded} leftSection={<ShieldCheck size={15} />} loading={busyAction === "validateSession"} onClick={onValidateSession} size="xs" variant="light">
          Validate Session
        </Button>
        <Button color="red" disabled={!connected || !sessionLoaded} leftSection={<Trash2 size={15} />} loading={busyAction === "clearSession"} onClick={onClearSession} size="xs" variant="light">
          Clear
        </Button>
      </Group>

      {session ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: session.snapshot.project?.graph.id ?? null,
              graphRevision: session.snapshot.project?.graph.revision ?? null,
              sessionRevision: session.snapshot.sessionRevision,
              viewRevision: session.snapshot.viewRevision,
              controlRevision: session.snapshot.controlRevision
            },
            null,
            2
          )}
        </Code>
      ) : null}
    </>
  );
}
