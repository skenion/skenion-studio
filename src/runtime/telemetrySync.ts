import type { RuntimeTelemetrySnapshot } from "./types";

export function telemetryPreviewBadgeColor(telemetry: RuntimeTelemetrySnapshot | null): string {
  if (!telemetry) {
    return "gray";
  }

  if (telemetry.preview.stale) {
    return "yellow";
  }

  switch (telemetry.preview.state) {
    case "running":
      return "green";
    case "starting":
      return "blue";
    case "error":
      return "red";
    case "exited":
      return "orange";
    case "stopped":
      return "gray";
  }
}

export function formatFps(value: number | null): string {
  return typeof value === "number" ? `${value.toFixed(1)} fps` : "n/a";
}

export function formatFrameMs(value: number | null): string {
  return typeof value === "number" ? `${value.toFixed(1)} ms` : "n/a";
}

export function formatUptimeMs(value: number): string {
  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

export function hasTelemetryRenderError(telemetry: RuntimeTelemetrySnapshot | null): boolean {
  return Boolean(telemetry?.render.lastError);
}
