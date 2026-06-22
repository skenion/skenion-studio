import { useMemo, useState } from "react";
import { Group, SegmentedControl, Text } from "@mantine/core";
import type { ValidationResult } from "@skenion/contracts";
import type { DisplayGraphDocumentV01 } from "../../graph/patchLibrary";
import type { GraphSemanticDiagnostic } from "../../graph/portSemantics";
import type {
  RuntimeActionResult,
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimeLogEvent,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../../runtime/types";
import { diagnosticCounts } from "../DiagnosticsFooter";
import styles from "./LogConsole.module.css";

export type LogSource = "client" | "runtime";
export type LogLevel = "info" | "warning" | "error";
export type LogSourceFilter = "all" | LogSource;

export interface LogLine {
  id: string;
  level: LogLevel;
  message: string;
  source: LogSource;
  timestamp: string;
}

export function logLinesFromRuntimeState({
  error,
  info,
  observedAt,
  previewStatus,
  result,
  semanticDiagnostics,
  session,
  status,
  telemetry,
  validation
}: {
  error: string | null;
  info: RuntimeInfo | null;
  observedAt: string;
  previewStatus: RuntimePreviewStatus | null;
  result: RuntimeActionResult | null;
  semanticDiagnostics: GraphSemanticDiagnostic[];
  session: RuntimeSessionResponse | null;
  status: RuntimeConnectionStatus;
  telemetry: RuntimeTelemetrySnapshot | null;
  validation: ValidationResult<DisplayGraphDocumentV01>;
}): LogLine[] {
  const counts = diagnosticCounts(validation, semanticDiagnostics);
  const lines: LogLine[] = [
    clientLine(
      "graph-diagnostics",
      counts.errors > 0 ? "error" : counts.warnings > 0 ? "warning" : "info",
      `graph diagnostics: ${counts.errors} errors, ${counts.warnings} warnings`,
      observedAt
    ),
    clientLine("runtime-connection", status === "error" ? "error" : "info", `runtime connection: ${status}`, observedAt)
  ];

  if (!validation.ok) {
    validation.errors.forEach((message, index) => {
      lines.push(clientLine(`schema-${index}`, "error", `graph schema: ${message}`, observedAt));
    });
  }

  semanticDiagnostics.forEach((diagnostic, index) => {
    lines.push(clientLine(`semantic-${index}`, diagnostic.severity, `${diagnostic.code}: ${diagnostic.message}`, observedAt));
  });

  if (error) {
    lines.push(clientLine("runtime-request-error", "error", error, observedAt));
  }

  if (info) {
    lines.push(runtimeLine("runtime-info", "info", `${info.name} ${info.version} api ${info.apiVersion}`, observedAt));
  }

  if (session) {
    const project = session.snapshot.project;
    lines.push(
      runtimeLine(
        "session",
        session.ok ? "info" : "error",
        project
          ? `session loaded: ${project.graph.id}@${project.graph.revision} revision ${session.snapshot.sessionRevision}`
          : "session unloaded",
        observedAt
      )
    );
    session.diagnostics.forEach((diagnostic, index) => {
      lines.push(runtimeLine(`session-diagnostic-${index}`, diagnostic.severity, diagnostic.message, observedAt));
    });
  }

  if (previewStatus) {
    const previewTimestamp = previewStatus.exitedAt ?? previewStatus.startedAt ?? observedAt;
    lines.push(
      runtimeLine(
        "preview",
        previewStatus.state === "error" || !previewStatus.ok ? "error" : "info",
        `preview: ${previewStatus.state}${previewStatus.message ? ` · ${previewStatus.message}` : ""}`,
        previewTimestamp
      )
    );
    previewStatus.diagnostics.forEach((diagnostic, index) => {
      lines.push(runtimeLine(`preview-diagnostic-${index}`, diagnostic.severity, diagnostic.message, previewTimestamp));
    });
  }

  if (telemetry) {
    lines.push(
      runtimeLine(
        "telemetry",
        telemetry.ok ? "info" : "error",
        `telemetry: preview ${telemetry.preview.state}, render ${telemetry.render.active ? "active" : "idle"}, frames ${telemetry.render.framesRendered}`,
        telemetry.timestamp
      )
    );
    if (telemetry.render.lastError) {
      lines.push(runtimeLine("render-last-error", "error", telemetry.render.lastError, telemetry.timestamp));
    }
    telemetry.diagnostics.forEach((diagnostic, index) => {
      lines.push(runtimeLine(`telemetry-diagnostic-${index}`, diagnostic.severity, diagnostic.message, telemetry.timestamp));
    });
    telemetry.render.diagnostics.forEach((diagnostic, index) => {
      lines.push(runtimeLine(`render-diagnostic-${index}`, diagnostic.severity, diagnostic.message, telemetry.timestamp));
    });
  }

  if (result) {
    lines.push(
      runtimeLine(
        "last-result",
        result.response.ok ? "info" : "error",
        `${result.kind}: ${result.response.ok ? "ok" : "failed"}`,
        result.receivedAt
      )
    );
    result.response.diagnostics.forEach((diagnostic: { severity: LogLevel; message: string }, index: number) => {
      lines.push(runtimeLine(`result-diagnostic-${index}`, diagnostic.severity, diagnostic.message, result.receivedAt));
    });
  }

  return lines;
}

export function mergeLogLines(lines: LogLine[]): LogLine[] {
  return [...lines].sort((left, right) => {
    const timeDiff = logTimestampMillis(left.timestamp) - logTimestampMillis(right.timestamp);
    return timeDiff === 0 ? left.id.localeCompare(right.id) : timeDiff;
  });
}

export function filterLogLines(lines: LogLine[], filter: LogSourceFilter): LogLine[] {
  return filter === "all" ? lines : lines.filter((line) => line.source === filter);
}

export function LogConsole({ lines }: { lines: LogLine[] }) {
  const [filter, setFilter] = useState<LogSourceFilter>("all");
  const sortedLines = useMemo(() => mergeLogLines(lines), [lines]);
  const filteredLines = useMemo(() => filterLogLines(sortedLines, filter), [filter, sortedLines]);

  return (
    <>
      <Group className={styles.toolbar} justify="space-between" wrap="nowrap">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Logs
        </Text>
        <SegmentedControl
          aria-label="Log source filter"
          data={[
            { label: "All", value: "all" },
            { label: "Client", value: "client" },
            { label: "Runtime", value: "runtime" }
          ]}
          onChange={(value) => setFilter(value as LogSourceFilter)}
          size="xs"
          value={filter}
        />
      </Group>
      <div aria-label="Logs" className={styles.console} role="log">
        {filteredLines.map((line) => (
          <div className={[styles.line, styles[line.level]].join(" ")} key={line.id}>
            <time className={styles.timestamp} dateTime={line.timestamp}>
              {formatLogTime(line.timestamp)}
            </time>
            <span className={styles.source}>{line.source}</span>
            <span className={styles.level}>{line.level}</span>
            <span className={styles.message}>{line.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function clientLogLine(id: string, level: LogLevel, message: string, timestamp: string): LogLine {
  return clientLine(id, level, message, timestamp);
}

export function runtimeLogLineFromEvent(event: RuntimeLogEvent): LogLine {
  return runtimeLine(
    `stream-${event.id}`,
    event.level,
    event.code ? `${event.code}: ${event.message}` : event.message,
    event.timestamp
  );
}

function clientLine(id: string, level: LogLevel, message: string, timestamp: string): LogLine {
  return {
    id: `client:${id}`,
    level,
    message,
    source: "client",
    timestamp
  };
}

function runtimeLine(id: string, level: LogLevel, message: string, timestamp: string): LogLine {
  return {
    id: `runtime:${id}`,
    level,
    message,
    source: "runtime",
    timestamp
  };
}

function formatLogTime(timestamp: string): string {
  const millis = logTimestampMillis(timestamp);
  if (Number.isNaN(millis)) {
    return "--:--:--";
  }
  const date = new Date(millis);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function logTimestampMillis(timestamp: string): number {
  if (timestamp.startsWith("unix-ms:")) {
    return Number(timestamp.slice("unix-ms:".length));
  }
  return Date.parse(timestamp);
}
