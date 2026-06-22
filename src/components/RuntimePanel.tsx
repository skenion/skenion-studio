import { Alert, Divider, Stack, Text } from "@mantine/core";
import { Activity } from "lucide-react";
import type { ValidationResult } from "@skenion/contracts";
import type {
  ManagedSidecarStatus,
  RuntimeProfileId,
  RuntimeProfileState
} from "../desktop/runtimeProfiles";
import type { StudioWindowMode } from "../desktop/windowRegistry";
import type { GraphSemanticDiagnostic } from "../graph/portSemantics";
import type { DisplayGraphDocumentV01 } from "../graph/patchLibrary";
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
  desktopAvailable: boolean;
  error: string | null;
  info: RuntimeInfo | null;
  profileState: RuntimeProfileState;
  result: RuntimeActionResult | null;
  previewStatus: RuntimePreviewStatus | null;
  session: RuntimeSessionResponse | null;
  sessionId: string;
  sessionSynced: boolean;
  sidecarStatus: ManagedSidecarStatus;
  status: RuntimeConnectionStatus;
  url: string;
  windowCount: number;
  windowMode: StudioWindowMode;
  onClearSession: () => void;
  onConnect: () => void;
  onOpenIsolatedWindow: () => void;
  onOpenSharedWindow: () => void;
  onPlanSession: () => void;
  onProfileChange: (profileId: RuntimeProfileId) => void;
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
  validation: ValidationResult<DisplayGraphDocumentV01>;
}

export function RuntimeSettingsPanel({
  busyAction,
  desktopAvailable,
  error,
  info,
  profileState,
  result,
  previewStatus,
  session,
  sessionId,
  sessionSynced,
  sidecarStatus,
  status,
  url,
  windowCount,
  windowMode,
  onClearSession,
  onConnect,
  onOpenIsolatedWindow,
  onOpenSharedWindow,
  onPlanSession,
  onProfileChange,
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
        desktopAvailable={desktopAvailable}
        onConnect={onConnect}
        onOpenIsolatedWindow={onOpenIsolatedWindow}
        onOpenSharedWindow={onOpenSharedWindow}
        onProfileChange={onProfileChange}
        onRefreshSession={onRefreshSession}
        onUrlChange={onUrlChange}
        profileState={profileState}
        sessionId={sessionId}
        sidecarStatus={sidecarStatus}
        status={status}
        url={url}
        windowCount={windowCount}
        windowMode={windowMode}
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
