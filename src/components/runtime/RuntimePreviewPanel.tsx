import { Alert, Badge, Button, Code, Group, Stack, Text } from "@mantine/core";
import { MonitorPlay, RefreshCw, RotateCw, Square } from "lucide-react";
import {
  canRestartPreview,
  canStartPreview,
  canStopPreview,
  previewBadgeColor,
  previewButtonVariant
} from "../../runtime/previewSync";
import type { RuntimePreviewStatus } from "../../runtime/types";

export function RuntimePreviewPanel({
  busyAction,
  connected,
  onRefreshPreview,
  onRestartPreview,
  onStartPreview,
  onStopPreview,
  previewStatus,
  sessionLoaded
}: {
  busyAction: string | null;
  connected: boolean;
  onRefreshPreview: () => void;
  onRestartPreview: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  previewStatus: RuntimePreviewStatus | null;
  sessionLoaded: boolean;
}) {
  const previewState = previewStatus?.state ?? "stopped";
  const previewStale = previewStatus?.stale ?? false;
  const previewActionState = { connected, sessionLoaded, previewStatus };

  return (
    <>
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
        <Button disabled={!connected} leftSection={<RefreshCw size={15} />} loading={busyAction === "previewStatus"} onClick={onRefreshPreview} radius="sm" size="xs" variant="light">
          Refresh Status
        </Button>
        <Button disabled={!canStartPreview(previewActionState)} leftSection={<MonitorPlay size={15} />} loading={busyAction === "startPreview"} onClick={onStartPreview} radius="sm" size="xs" variant={previewState === "stopped" ? "filled" : "light"}>
          Start Preview
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!canStopPreview(previewStatus)} leftSection={<Square size={15} />} loading={busyAction === "stopPreview"} onClick={onStopPreview} radius="sm" size="xs" variant="light">
          Stop Preview
        </Button>
        <Button disabled={!canRestartPreview(previewActionState)} leftSection={<RotateCw size={15} />} loading={busyAction === "restartPreview"} onClick={onRestartPreview} radius="sm" size="xs" variant={previewButtonVariant(previewStatus)}>
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
    </>
  );
}
