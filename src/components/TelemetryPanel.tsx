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
          <Badge color={telemetry ? "green" : "gray"} variant="light">
            {telemetry ? "online" : "unavailable"}
          </Badge>
          {telemetry ? (
            <Badge color={telemetryPreviewBadgeColor(telemetry)} variant="light">
              {telemetry.preview.stale ? "stale" : telemetry.preview.state}
            </Badge>
          ) : null}
          {telemetry ? (
            <Badge color={telemetry.render.controlLive ? "teal" : "yellow"} variant="light">
              {telemetry.render.controlLive ? "control live" : "control pending"}
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
                  sessionRevision: telemetry.session.sessionRevision,
                  controlRevision: telemetry.session.controlRevision
                }
              : null,
            preview: telemetry
              ? {
                  state: telemetry.preview.state,
                  stale: telemetry.preview.stale,
                  pid: telemetry.preview.pid,
                  graphRevision: telemetry.preview.graphRevision,
                  previewSessionRevision: telemetry.preview.previewSessionRevision,
                  controlRevision: telemetry.preview.controlRevision,
                  previewControlRevision: telemetry.preview.previewControlRevision,
                  controlLive: telemetry.preview.controlLive,
                  lastControlUpdateAt: telemetry.preview.lastControlUpdateAt
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
                  sourceNodeId: telemetry.render.sourceNodeId,
                  generatedSourceAvailable: telemetry.render.generatedSourceAvailable,
                  controlRevision: telemetry.render.controlRevision,
                  previewControlRevision: telemetry.render.previewControlRevision,
                  controlLive: telemetry.render.controlLive,
                  lastControlUpdateAt: telemetry.render.lastControlUpdateAt
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
        <Alert color="red" icon={<Activity size={16} />} variant="light">
          {telemetry.render.lastError}
        </Alert>
      ) : null}

      {telemetry?.render.diagnostics.length ? (
        <Alert color={renderError ? "red" : "yellow"} icon={<Activity size={16} />} variant="light">
          <Stack gap={4}>
            {telemetry.render.diagnostics.slice(0, 5).map((diagnostic, index) => (
              <Text key={`${diagnostic.phase}:${diagnostic.code}:${index}`} size="xs">
                <Code>{diagnostic.phase}</Code> {diagnostic.code}: {diagnostic.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}
