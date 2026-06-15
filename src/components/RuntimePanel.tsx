import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  NumberInput,
  Stack,
  Text,
  TextInput
} from "@mantine/core";
import { Activity, Cable, Play, Route, ShieldCheck } from "lucide-react";
import type { RuntimeActionResult, RuntimeConnectionStatus, RuntimeInfo } from "../runtime/types";

interface RuntimePanelProps {
  busyAction: string | null;
  error: string | null;
  frames: number;
  info: RuntimeInfo | null;
  result: RuntimeActionResult | null;
  status: RuntimeConnectionStatus;
  url: string;
  onConnect: () => void;
  onFramesChange: (frames: number) => void;
  onPlan: () => void;
  onRun: () => void;
  onUrlChange: (url: string) => void;
  onValidate: () => void;
}

export function RuntimePanel({
  busyAction,
  error,
  frames,
  info,
  result,
  status,
  url,
  onConnect,
  onFramesChange,
  onPlan,
  onRun,
  onUrlChange,
  onValidate
}: RuntimePanelProps) {
  const connected = status === "connected";

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
          leftSection={<ShieldCheck size={15} />}
          loading={busyAction === "validate"}
          onClick={onValidate}
          radius="sm"
          size="xs"
          variant="light"
        >
          Validate
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button
          disabled={!connected}
          leftSection={<Route size={15} />}
          loading={busyAction === "plan"}
          onClick={onPlan}
          radius="sm"
          size="xs"
          variant="light"
        >
          Plan
        </Button>
        <Button
          disabled={!connected}
          leftSection={<Play size={15} />}
          loading={busyAction === "run"}
          onClick={onRun}
          radius="sm"
          size="xs"
          variant="light"
        >
          Run
        </Button>
      </Group>

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
