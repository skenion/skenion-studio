import { TelemetryPanel } from "../TelemetryPanel";
import type { RuntimeTelemetrySnapshot } from "../../runtime/types";

export function RuntimeTelemetryPanel({
  telemetry
}: {
  telemetry: RuntimeTelemetrySnapshot | null;
}) {
  return <TelemetryPanel telemetry={telemetry} />;
}
