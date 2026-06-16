import { Alert, Badge, Button, Code, Group, Text } from "@mantine/core";
import { SendHorizontal, X } from "lucide-react";

interface RuntimePatchPanelProps {
  busyAction: string | null;
  connected: boolean;
  patchBaseRevision: string | null;
  patchConflict: string | null;
  pendingPatchOps: number;
  sessionLoaded: boolean;
  onApplyPendingPatch: () => void;
  onClearPendingPatch: () => void;
}

export function RuntimePatchPanel({
  busyAction,
  connected,
  patchBaseRevision,
  patchConflict,
  pendingPatchOps,
  sessionLoaded,
  onApplyPendingPatch,
  onClearPendingPatch
}: RuntimePatchPanelProps) {
  const hasPendingPatch = pendingPatchOps > 0;

  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          Patch Sync
        </Text>
        <Badge color={patchBadgeColor(hasPendingPatch, patchConflict)} radius="sm" variant="light">
          {patchBadgeLabel(hasPendingPatch, patchConflict)}
        </Badge>
      </Group>

      <Code block className="runtime-json">
        {JSON.stringify(
          {
            pendingOps: pendingPatchOps,
            baseRevision: patchBaseRevision
          },
          null,
          2
        )}
      </Code>

      <Group gap="xs" grow>
        <Button
          disabled={!connected || !sessionLoaded || !hasPendingPatch}
          leftSection={<SendHorizontal size={15} />}
          loading={busyAction === "applyPatch"}
          onClick={onApplyPendingPatch}
          radius="sm"
          size="xs"
          variant={hasPendingPatch ? "filled" : "light"}
        >
          Apply Pending Patch
        </Button>
        <Button
          disabled={!hasPendingPatch}
          leftSection={<X size={15} />}
          onClick={onClearPendingPatch}
          radius="sm"
          size="xs"
          variant="light"
        >
          Clear Pending
        </Button>
      </Group>

      {patchConflict ? (
        <Alert color="red" radius="sm" variant="light">
          {patchConflict}
        </Alert>
      ) : null}
    </>
  );
}

function patchBadgeColor(hasPendingPatch: boolean, conflict: string | null): string {
  if (conflict) {
    return "red";
  }
  return hasPendingPatch ? "yellow" : "green";
}

function patchBadgeLabel(hasPendingPatch: boolean, conflict: string | null): string {
  if (conflict) {
    return "conflict";
  }
  return hasPendingPatch ? "pending patch" : "no pending patch";
}
