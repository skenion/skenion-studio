import { Alert, Badge, Code, Group, Stack, Text } from "@mantine/core";
import { Activity } from "lucide-react";
import {
  formatFps,
  formatFrameMs,
  formatUptimeMs,
  hasTelemetryRenderError,
  telemetryPreviewBadgeColor
} from "../runtime/telemetrySync";
import type { RuntimeTelemetrySnapshot } from "../runtime/types";

interface TelemetryPanelProps {
  telemetry: RuntimeTelemetrySnapshot | null;
}

export function TelemetryPanel({ telemetry }: TelemetryPanelProps) {
  const renderError = hasTelemetryRenderError(telemetry);

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          Runtime Telemetry
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={telemetry ? "green" : "gray"} radius="sm" variant="light">
            {telemetry ? "online" : "unavailable"}
          </Badge>
          {telemetry ? (
            <Badge color={telemetryPreviewBadgeColor(telemetry)} radius="sm" variant="light">
              {telemetry.preview.stale ? "stale" : telemetry.preview.state}
            </Badge>
          ) : null}
        </Group>
      </Group>

      <Code block className="runtime-json">
        {JSON.stringify(
          {
            timestamp: telemetry?.timestamp ?? null,
            session: telemetry
              ? {
                  loaded: telemetry.session.loaded,
                  graphId: telemetry.session.graphId,
                  graphRevision: telemetry.session.graphRevision,
                  sessionRevision: telemetry.session.sessionRevision
                }
              : null,
            preview: telemetry
              ? {
                  state: telemetry.preview.state,
                  stale: telemetry.preview.stale,
                  pid: telemetry.preview.pid,
                  graphRevision: telemetry.preview.graphRevision,
                  previewSessionRevision: telemetry.preview.previewSessionRevision
                }
              : null,
            render: telemetry
              ? {
                  active: telemetry.render.active,
                  backend: telemetry.render.backend,
                  renderer: telemetry.render.renderer,
                  framesRendered: telemetry.render.framesRendered,
                  approxFps: formatFps(telemetry.render.approxFps),
                  lastFrameMs: formatFrameMs(telemetry.render.lastFrameMs),
                  sourceNodeId: telemetry.render.sourceNodeId
                }
              : null,
            process: telemetry
              ? {
                  runtimeVersion: telemetry.process.runtimeVersion,
                  uptime: formatUptimeMs(telemetry.process.uptimeMs)
                }
              : null
          },
          null,
          2
        )}
      </Code>

      {renderError && telemetry?.render.lastError ? (
        <Alert color="red" icon={<Activity size={16} />} radius="sm" variant="light">
          {telemetry.render.lastError}
        </Alert>
      ) : null}
    </Stack>
  );
}
