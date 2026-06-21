import { Alert, Divider, Stack, Text } from "@mantine/core";
import { Activity } from "lucide-react";
import type { GraphDocumentV01, ValidationResult } from "@skenion/contracts";
import type { GraphSemanticDiagnostic } from "../graph/portSemantics";
import type {
  RuntimeActionResult,
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../runtime/types";
import { RuntimeConnectionPanel } from "./runtime/RuntimeConnectionPanel";
import { LogConsole, logLinesFromRuntimeState, mergeLogLines, type LogLine } from "./log/LogConsole";
import { RuntimePreviewPanel } from "./runtime/RuntimePreviewPanel";
import { RuntimeResultSummary } from "./runtime/RuntimeResultSummary";
import { RuntimeSessionPanel } from "./runtime/RuntimeSessionPanel";

interface RuntimeSettingsPanelProps {
  busyAction: string | null;
  error: string | null;
  info: RuntimeInfo | null;
  result: RuntimeActionResult | null;
  previewStatus: RuntimePreviewStatus | null;
  session: RuntimeSessionResponse | null;
  sessionSynced: boolean;
  status: RuntimeConnectionStatus;
  url: string;
  onClearSession: () => void;
  onConnect: () => void;
  onPlanSession: () => void;
  onRefreshPreview: () => void;
  onRestartPreview: () => void;
  onRefreshSession: () => void;
  onRunSession: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  onUrlChange: (url: string) => void;
  onValidateSession: () => void;
}

interface RuntimeLogsPanelProps {
  clientLines: LogLine[];
  error: string | null;
  info: RuntimeInfo | null;
  previewStatus: RuntimePreviewStatus | null;
  result: RuntimeActionResult | null;
  runtimeLines: LogLine[];
  semanticDiagnostics: GraphSemanticDiagnostic[];
  session: RuntimeSessionResponse | null;
  status: RuntimeConnectionStatus;
  telemetry: RuntimeTelemetrySnapshot | null;
  validation: ValidationResult<GraphDocumentV01>;
}

export function RuntimeSettingsPanel({
  busyAction,
  error,
  info,
  result,
  previewStatus,
  session,
  sessionSynced,
  status,
  url,
  onClearSession,
  onConnect,
  onPlanSession,
  onRefreshPreview,
  onRestartPreview,
  onRefreshSession,
  onRunSession,
  onStartPreview,
  onStopPreview,
  onUrlChange,
  onValidateSession
}: RuntimeSettingsPanelProps) {
  const connected = status === "connected";
  const sessionLoaded = Boolean(session?.snapshot.project);

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

      {info ? (
        <Alert color="blue" icon={<Activity size={16} />} variant="light">
          <Text fw={700} size="sm">
            {info.name} {info.version}
          </Text>
          <Text c="dimmed" size="xs">
            API {info.apiVersion} · {info.capabilities.join(", ")}
          </Text>
        </Alert>
      ) : null}

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}

      {result ? <RuntimeResultSummary result={result} /> : null}
    </Stack>
  );
}

export function RuntimeLogsPanel({
  clientLines,
  error,
  info,
  previewStatus,
  result,
  runtimeLines,
  semanticDiagnostics,
  session,
  status,
  telemetry,
  validation
}: RuntimeLogsPanelProps) {
  const lines = mergeLogLines([
    ...clientLines,
    ...runtimeLines,
    ...logLinesFromRuntimeState({
      error,
      info,
      observedAt: new Date().toISOString(),
      previewStatus,
      result,
      semanticDiagnostics,
      session,
      status,
      telemetry,
      validation
    })
  ]);

  return (
    <Stack className="runtime-panel" gap="sm">
      <LogConsole lines={lines} />
    </Stack>
  );
}
