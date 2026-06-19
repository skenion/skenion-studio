import { Alert, Divider, Stack, Text } from "@mantine/core";
import { Activity } from "lucide-react";
import type { GraphPatchHistoryV01 } from "@skenion/contracts";
import {
  latestHistoryEvents,
  runtimeHistoryActionAvailability
} from "../runtime/historySync";
import type {
  RuntimeActionResult,
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../runtime/types";
import { RuntimeConnectionPanel } from "./runtime/RuntimeConnectionPanel";
import { RuntimeHistoryPanel } from "./runtime/RuntimeHistoryPanel";
import { RuntimePreviewPanel } from "./runtime/RuntimePreviewPanel";
import { RuntimeResultSummary } from "./runtime/RuntimeResultSummary";
import { RuntimeSessionPanel } from "./runtime/RuntimeSessionPanel";
import { RuntimeTelemetryPanel } from "./runtime/RuntimeTelemetryPanel";

interface RuntimePanelProps {
  busyAction: string | null;
  error: string | null;
  info: RuntimeInfo | null;
  result: RuntimeActionResult | null;
  history: GraphPatchHistoryV01 | null;
  previewStatus: RuntimePreviewStatus | null;
  session: RuntimeSessionResponse | null;
  sessionSynced: boolean;
  telemetry: RuntimeTelemetrySnapshot | null;
  status: RuntimeConnectionStatus;
  url: string;
  onClearSession: () => void;
  onConnect: () => void;
  onPlanSession: () => void;
  onRefreshPreview: () => void;
  onRedoPatch: () => void;
  onRestartPreview: () => void;
  onRefreshHistory: () => void;
  onRefreshSession: () => void;
  onRunSession: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  onUndoPatch: () => void;
  onUrlChange: (url: string) => void;
  onValidateSession: () => void;
}

export function RuntimePanel({
  busyAction,
  error,
  info,
  result,
  history,
  previewStatus,
  session,
  sessionSynced,
  telemetry,
  status,
  url,
  onClearSession,
  onConnect,
  onPlanSession,
  onRefreshPreview,
  onRedoPatch,
  onRestartPreview,
  onRefreshHistory,
  onRefreshSession,
  onRunSession,
  onStartPreview,
  onStopPreview,
  onUndoPatch,
  onUrlChange,
  onValidateSession
}: RuntimePanelProps) {
  const connected = status === "connected";
  const sessionLoaded = session?.loaded ?? false;
  const historyAvailability = runtimeHistoryActionAvailability({
    connected,
    sessionLoaded,
    sessionSynced,
    pendingPatchOps: 0,
    history
  });
  const latestEvents = latestHistoryEvents(history, 3);

  return (
    <Stack className="runtime-panel" gap="sm">
      <RuntimeConnectionPanel
        busyAction={busyAction}
        connected={connected}
        onConnect={onConnect}
        onRefreshSession={onRefreshSession}
        onUrlChange={onUrlChange}
        status={status}
        url={url}
      />

      <Divider />

      <RuntimeSessionPanel
        busyAction={busyAction}
        connected={connected}
        onClearSession={onClearSession}
        onPlanSession={onPlanSession}
        onRunSession={onRunSession}
        onValidateSession={onValidateSession}
        session={session}
        sessionLoaded={sessionLoaded}
        sessionSynced={sessionSynced}
      />

      <Divider />

      <RuntimePreviewPanel
        busyAction={busyAction}
        connected={connected}
        onRefreshPreview={onRefreshPreview}
        onRestartPreview={onRestartPreview}
        onStartPreview={onStartPreview}
        onStopPreview={onStopPreview}
        previewStatus={previewStatus}
        sessionLoaded={sessionLoaded}
      />

      <RuntimeTelemetryPanel telemetry={telemetry} />

      <Divider />

      <RuntimeHistoryPanel
        busyAction={busyAction}
        connected={connected}
        history={history}
        historyAvailability={historyAvailability}
        latestEvents={latestEvents}
        onRedoPatch={onRedoPatch}
        onRefreshHistory={onRefreshHistory}
        onUndoPatch={onUndoPatch}
        sessionLoaded={sessionLoaded}
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
