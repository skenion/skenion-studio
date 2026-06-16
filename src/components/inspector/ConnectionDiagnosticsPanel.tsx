import { Alert } from "@mantine/core";
import type { ConnectionCheck } from "../../graph/skenionGraph";

export function ConnectionDiagnosticsPanel({
  connectionCheck
}: {
  connectionCheck: ConnectionCheck | null;
}) {
  if (!connectionCheck) {
    return null;
  }

  return (
    <Alert color={connectionCheck.ok ? "green" : "red"} radius="sm" variant="light">
      {connectionCheck.message}
    </Alert>
  );
}
