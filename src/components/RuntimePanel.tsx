import {
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { Activity, Cable, Database, Play, RefreshCw, Route, ShieldCheck, Trash2 } from "lucide-react";
import type {
  RuntimeActionResult,
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimeSessionResponse
} from "../runtime/types";

interface RuntimePanelProps {
  busyAction: string | null;
  error: string | null;
  frames: number;
  info: RuntimeInfo | null;
  result: RuntimeActionResult | null;
  session: RuntimeSessionResponse | null;
  sessionSynced: boolean;
  status: RuntimeConnectionStatus;
  url: string;
  onClearSession: () => void;
  onConnect: () => void;
  onFramesChange: (frames: number) => void;
  onLoadSession: () => void;
  onPlan: () => void;
  onPlanSession: () => void;
  onRefreshSession: () => void;
  onRun: () => void;
  onRunSession: () => void;
  onUrlChange: (url: string) => void;
  onValidate: () => void;
  onValidateSession: () => void;
}

export function RuntimePanel({
  busyAction,
  error,
  frames,
  info,
  result,
  session,
  sessionSynced,
  status,
  url,
  onClearSession,
  onConnect,
  onFramesChange,
  onLoadSession,
  onPlan,
  onPlanSession,
  onRefreshSession,
  onRun,
  onRunSession,
  onUrlChange,
  onValidate,
  onValidateSession
}: RuntimePanelProps) {
  const connected = status === "connected";
  const sessionLoaded = session?.loaded ?? false;

  return (
    <Stack className="runtime-panel" gap="sm">
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

      <Divider />

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
        <Button
          disabled={!connected}
          leftSection={<Database size={15} />}
          loading={busyAction === "loadSession"}
          onClick={onLoadSession}
          radius="sm"
          size="xs"
        >
          Load Current Graph
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button
          disabled={!connected || !sessionLoaded}
          leftSection={<Route size={15} />}
          loading={busyAction === "planSession"}
          onClick={onPlanSession}
          radius="sm"
          size="xs"
          variant="light"
        >
          Plan Session
        </Button>
        <Button
          disabled={!connected || !sessionLoaded}
          leftSection={<Play size={15} />}
          loading={busyAction === "runSession"}
          onClick={onRunSession}
          radius="sm"
          size="xs"
          variant="light"
        >
          Run Session
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button
          disabled={!connected || !sessionLoaded}
          leftSection={<ShieldCheck size={15} />}
          loading={busyAction === "validateSession"}
          onClick={onValidateSession}
          radius="sm"
          size="xs"
          variant="light"
        >
          Validate Session
        </Button>
        <Button
          color="red"
          disabled={!connected || !sessionLoaded}
          leftSection={<Trash2 size={15} />}
          loading={busyAction === "clearSession"}
          onClick={onClearSession}
          radius="sm"
          size="xs"
          variant="light"
        >
          Clear
        </Button>
      </Group>

      {session ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: session.graphId,
              graphRevision: session.graphRevision,
              sessionRevision: session.sessionRevision
            },
            null,
            2
          )}
        </Code>
      ) : null}

      <NumberInput
        aria-label="Dummy execution frames"
        clampBehavior="strict"
        disabled={!connected || busyAction !== null}
        label="Frames"
        max={120}
        min={1}
        onChange={(value) => onFramesChange(typeof value === "number" ? value : 1)}
        radius="sm"
        size="xs"
        value={frames}
      />

      <Divider />

      <Text c="dimmed" size="xs">
        Stateless Tools
      </Text>

      <Group gap="xs" grow>
        <Button
          disabled={!connected}
          leftSection={<ShieldCheck size={15} />}
          loading={busyAction === "validate"}
          onClick={onValidate}
          radius="sm"
          size="xs"
          variant="subtle"
        >
          Validate Payload
        </Button>
        <Button
          disabled={!connected}
          leftSection={<Route size={15} />}
          loading={busyAction === "plan"}
          onClick={onPlan}
          radius="sm"
          size="xs"
          variant="subtle"
        >
          Plan Payload
        </Button>
      </Group>

      <Button
        disabled={!connected}
        leftSection={<Play size={15} />}
        loading={busyAction === "run"}
        onClick={onRun}
        radius="sm"
        size="xs"
        variant="subtle"
      >
        Run Payload
      </Button>

      {info ? (
        <Alert color="blue" icon={<Activity size={16} />} radius="sm" variant="light">
          <Text fw={700} size="sm">
            {info.name} {info.version}
          </Text>
          <Text c="dimmed" size="xs">
            API {info.apiVersion} · {info.capabilities.join(", ")}
          </Text>
        </Alert>
      ) : null}

      {error ? (
        <Alert color="red" radius="sm" variant="light">
          {error}
        </Alert>
      ) : null}

      {result ? <RuntimeResultSummary result={result} /> : null}
    </Stack>
  );
}

function RuntimeResultSummary({ result }: { result: RuntimeActionResult }) {
  const diagnostics = result.response.diagnostics;
  const plan = result.response.plan;
  const report = result.response.report;

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={800} size="sm">
          {result.kind}
        </Text>
        <Badge color={result.response.ok ? "green" : "red"} radius="sm" variant="light">
          {result.response.ok ? "ok" : "diagnostics"}
        </Badge>
      </Group>

      {diagnostics.length > 0 ? (
        <Stack gap={4}>
          {diagnostics.slice(0, 5).map((diagnostic) => (
            <Alert color={diagnostic.severity === "error" ? "red" : "yellow"} key={diagnostic.message} radius="sm" variant="light">
              {diagnostic.message}
            </Alert>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed" size="xs">
          Runtime diagnostics clear
        </Text>
      )}

      {plan ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: plan.graphId,
              nodes: plan.nodes.length,
              edges: plan.edges.length,
              groups: plan.groups.map((group) => ({
                executionModel: group.executionModel,
                nodeIds: group.nodeIds
              }))
            },
            null,
            2
          )}
        </Code>
      ) : null}

      {report ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: report.graphId,
              frameCount: report.frameCount,
              firstFrame: report.frames[0]?.executedNodes.map((node) => ({
                nodeId: node.nodeId,
                order: node.order,
                status: node.status
              }))
            },
            null,
            2
          )}
        </Code>
      ) : null}
    </Stack>
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
