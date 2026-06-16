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
import {
  Activity,
  Cable,
  Database,
  History,
  MonitorPlay,
  Play,
  RefreshCw,
  Redo2,
  RotateCw,
  Route,
  SendHorizontal,
  ShieldCheck,
  Square,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import type { GraphPatchHistoryV01 } from "@skenion/contracts";
import {
  latestHistoryEvents,
  runtimeHistoryActionAvailability
} from "../runtime/historySync";
import {
  canRestartPreview,
  canStartPreview,
  canStopPreview,
  previewBadgeColor,
  previewButtonVariant
} from "../runtime/previewSync";
import type {
  RuntimeActionResult,
  RuntimeActionResponse,
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimePreviewStatus,
  RuntimeSessionResponse
} from "../runtime/types";

interface RuntimePanelProps {
  busyAction: string | null;
  error: string | null;
  frames: number;
  info: RuntimeInfo | null;
  result: RuntimeActionResult | null;
  history: GraphPatchHistoryV01 | null;
  previewStatus: RuntimePreviewStatus | null;
  session: RuntimeSessionResponse | null;
  sessionSynced: boolean;
  patchBaseRevision: string | null;
  patchConflict: string | null;
  pendingPatchOps: number;
  status: RuntimeConnectionStatus;
  url: string;
  onApplyPendingPatch: () => void;
  onClearSession: () => void;
  onClearPendingPatch: () => void;
  onConnect: () => void;
  onFramesChange: (frames: number) => void;
  onLoadSession: () => void;
  onPlan: () => void;
  onPlanSession: () => void;
  onRefreshPreview: () => void;
  onRedoPatch: () => void;
  onRestartPreview: () => void;
  onRefreshHistory: () => void;
  onRefreshSession: () => void;
  onRun: () => void;
  onRunSession: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  onUndoPatch: () => void;
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
  history,
  previewStatus,
  session,
  sessionSynced,
  patchBaseRevision,
  patchConflict,
  pendingPatchOps,
  status,
  url,
  onApplyPendingPatch,
  onClearSession,
  onClearPendingPatch,
  onConnect,
  onFramesChange,
  onLoadSession,
  onPlan,
  onPlanSession,
  onRefreshPreview,
  onRedoPatch,
  onRestartPreview,
  onRefreshHistory,
  onRefreshSession,
  onRun,
  onRunSession,
  onStartPreview,
  onStopPreview,
  onUndoPatch,
  onUrlChange,
  onValidate,
  onValidateSession
}: RuntimePanelProps) {
  const connected = status === "connected";
  const sessionLoaded = session?.loaded ?? false;
  const hasPendingPatch = pendingPatchOps > 0;
  const historyAvailability = runtimeHistoryActionAvailability({
    connected,
    sessionLoaded,
    sessionSynced,
    pendingPatchOps,
    history
  });
  const latestEvents = latestHistoryEvents(history, 3);
  const previewState = previewStatus?.state ?? "stopped";
  const previewStale = previewStatus?.stale ?? false;
  const previewActionState = {
    connected,
    sessionLoaded,
    previewStatus
  };

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

      <Divider />

      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          Preview
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={previewBadgeColor(previewState, previewStale)} radius="sm" variant="light">
            {previewState}
          </Badge>
          {previewStale ? (
            <Badge color="yellow" radius="sm" variant="light">
              stale
            </Badge>
          ) : null}
        </Group>
      </Group>

      <Code block className="runtime-json">
        {JSON.stringify(
          {
            pid: previewStatus?.pid ?? null,
            graphRevision: previewStatus?.graphRevision ?? null,
            sessionRevision: previewStatus?.sessionRevision ?? null,
            previewSessionRevision: previewStatus?.previewSessionRevision ?? null
          },
          null,
          2
        )}
      </Code>

      <Group gap="xs" grow>
        <Button
          disabled={!connected}
          leftSection={<RefreshCw size={15} />}
          loading={busyAction === "previewStatus"}
          onClick={onRefreshPreview}
          radius="sm"
          size="xs"
          variant="light"
        >
          Refresh Status
        </Button>
        <Button
          disabled={!canStartPreview(previewActionState)}
          leftSection={<MonitorPlay size={15} />}
          loading={busyAction === "startPreview"}
          onClick={onStartPreview}
          radius="sm"
          size="xs"
          variant={previewState === "stopped" ? "filled" : "light"}
        >
          Start Preview
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button
          disabled={!canStopPreview(previewStatus)}
          leftSection={<Square size={15} />}
          loading={busyAction === "stopPreview"}
          onClick={onStopPreview}
          radius="sm"
          size="xs"
          variant="light"
        >
          Stop Preview
        </Button>
        <Button
          disabled={!canRestartPreview(previewActionState)}
          leftSection={<RotateCw size={15} />}
          loading={busyAction === "restartPreview"}
          onClick={onRestartPreview}
          radius="sm"
          size="xs"
          variant={previewButtonVariant(previewStatus)}
        >
          Restart Preview
        </Button>
      </Group>

      {previewStatus?.diagnostics.length ? (
        <Stack gap={4}>
          {previewStatus.diagnostics.slice(0, 3).map((diagnostic) => (
            <Alert color={diagnostic.severity === "error" ? "red" : "yellow"} key={diagnostic.message} radius="sm" variant="light">
              {diagnostic.message}
            </Alert>
          ))}
        </Stack>
      ) : null}

      <Divider />

      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          Patch Sync
        </Text>
        <Badge color={patchBadgeColor(hasPendingPatch, patchConflict)} radius="sm" variant="light">
          {patchBadgeLabel(hasPendingPatch, patchConflict)}
        </Badge>
      </Group>

      <Code block className="runtime-json">
        {JSON.stringify(
          {
            pendingOps: pendingPatchOps,
            baseRevision: patchBaseRevision
          },
          null,
          2
        )}
      </Code>

      <Group gap="xs" grow>
        <Button
          disabled={!connected || !sessionLoaded || !hasPendingPatch}
          leftSection={<SendHorizontal size={15} />}
          loading={busyAction === "applyPatch"}
          onClick={onApplyPendingPatch}
          radius="sm"
          size="xs"
          variant={hasPendingPatch ? "filled" : "light"}
        >
          Apply Pending Patch
        </Button>
        <Button
          disabled={!hasPendingPatch}
          leftSection={<X size={15} />}
          onClick={onClearPendingPatch}
          radius="sm"
          size="xs"
          variant="light"
        >
          Clear Pending
        </Button>
      </Group>

      {patchConflict ? (
        <Alert color="red" radius="sm" variant="light">
          {patchConflict}
        </Alert>
      ) : null}

      <Divider />

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
  const plan = responsePlan(result.response);
  const report = responseReport(result.response);

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

function responsePlan(response: RuntimeActionResponse) {
  return "plan" in response ? response.plan : response.session.plan;
}

function responseReport(response: RuntimeActionResponse) {
  return "report" in response ? response.report : response.session.report;
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

function patchBadgeColor(hasPendingPatch: boolean, conflict: string | null): string {
  if (conflict) {
    return "red";
  }
  return hasPendingPatch ? "yellow" : "green";
}

function patchBadgeLabel(hasPendingPatch: boolean, conflict: string | null): string {
  if (conflict) {
    return "conflict";
  }
  return hasPendingPatch ? "pending patch" : "no pending patch";
}
