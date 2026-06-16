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
import { RuntimePatchPanel } from "./runtime/RuntimePatchPanel";
import { RuntimePreviewPanel } from "./runtime/RuntimePreviewPanel";
import { RuntimeResultSummary } from "./runtime/RuntimeResultSummary";
import { RuntimeSessionPanel } from "./runtime/RuntimeSessionPanel";
import { RuntimeStatelessToolsPanel } from "./runtime/RuntimeStatelessToolsPanel";
import { RuntimeTelemetryPanel } from "./runtime/RuntimeTelemetryPanel";

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
  telemetry: RuntimeTelemetrySnapshot | null;
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
  telemetry,
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
  const historyAvailability = runtimeHistoryActionAvailability({
    connected,
    sessionLoaded,
    sessionSynced,
    pendingPatchOps,
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
        onLoadSession={onLoadSession}
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

      <RuntimePatchPanel
        busyAction={busyAction}
        connected={connected}
        onApplyPendingPatch={onApplyPendingPatch}
        onClearPendingPatch={onClearPendingPatch}
        patchBaseRevision={patchBaseRevision}
        patchConflict={patchConflict}
        pendingPatchOps={pendingPatchOps}
        sessionLoaded={sessionLoaded}
      />

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

      <Divider />

      <RuntimeStatelessToolsPanel
        busyAction={busyAction}
        connected={connected}
        frames={frames}
        onFramesChange={onFramesChange}
        onPlan={onPlan}
        onRun={onRun}
        onValidate={onValidate}
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
