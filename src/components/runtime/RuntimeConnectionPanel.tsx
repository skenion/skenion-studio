import { Badge, Group, SegmentedControl, Text, TextInput } from "@mantine/core";
import { Cable, MonitorCog, MonitorUp, RefreshCw } from "lucide-react";
import type {
  ManagedSidecarStatus,
  RuntimeProfileId,
  RuntimeProfileState
} from "../../desktop/runtimeProfiles";
import type { StudioWindowMode } from "../../desktop/windowRegistry";
import type { RuntimeConnectionStatus } from "../../runtime/types";
import { Button } from "../core/Button/Button";

export function RuntimeConnectionPanel({
  busyAction,
  connected,
  desktopAvailable,
  onConnect,
  onOpenIsolatedWindow,
  onOpenSharedWindow,
  onProfileChange,
  onRefreshSession,
  onUrlChange,
  profileState,
  sessionId,
  sidecarStatus,
  status,
  url,
  windowCount,
  windowMode
}: {
  busyAction: string | null;
  connected: boolean;
  desktopAvailable: boolean;
  onConnect: () => void;
  onOpenIsolatedWindow: () => void;
  onOpenSharedWindow: () => void;
  onProfileChange: (profileId: RuntimeProfileId) => void;
  onRefreshSession: () => void;
  onUrlChange: (url: string) => void;
  profileState: RuntimeProfileState;
  sessionId: string;
  sidecarStatus: ManagedSidecarStatus;
  status: RuntimeConnectionStatus;
  url: string;
  windowCount: number;
  windowMode: StudioWindowMode;
}) {
  const activeProfile = profileState.profiles[profileState.activeProfileId];
  const endpointInputDisabled = busyAction !== null || activeProfile.mode === "local-managed";

  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800} size="sm">
            Runtime
          </Text>
          <Text c="dimmed" size="xs">
            {activeProfile.mode} · session {sessionId}
          </Text>
        </div>
        <Group gap={6}>
          <Badge color={sidecarStatusColor(sidecarStatus)} variant="light">
            {sidecarStatus}
          </Badge>
          <Badge color={statusColor(status)} variant="light">
            {status}
          </Badge>
        </Group>
      </Group>

      <Text c="dimmed" size="xs">
        Profile
      </Text>
      <SegmentedControl
        data={[
          { label: "Managed", value: "local-managed" },
          { label: "Shared", value: "local-shared" },
          { label: "Remote", value: "remote" }
        ]}
        disabled={busyAction !== null}
        onChange={(value) => onProfileChange(value as RuntimeProfileId)}
        size="xs"
        value={profileState.activeProfileId}
      />
      <Text c="dimmed" size="xs">
        Endpoint
      </Text>
      <TextInput
        aria-label="Runtime URL"
        disabled={endpointInputDisabled}
        onChange={(event) => onUrlChange(event.currentTarget.value)}
        size="xs"
        value={url}
      />
      <Group gap="xs" grow>
        <Button
          leftSection={<Cable size={15} />}
          loading={busyAction === "connect"}
          onClick={onConnect}
          size="xs"
          variant={connected ? "light" : "filled"}
        >
          Connect
        </Button>
        <Button
          disabled={!connected}
          leftSection={<RefreshCw size={15} />}
          loading={busyAction === "session"}
          onClick={onRefreshSession}
          size="xs"
          variant="light"
        >
          Refresh
        </Button>
      </Group>
      <Group gap="xs" grow>
        <Button
          disabled={!desktopAvailable}
          leftSection={<MonitorUp size={15} />}
          onClick={onOpenSharedWindow}
          size="xs"
          variant="light"
        >
          Shared Window
        </Button>
        <Button
          disabled={!desktopAvailable}
          leftSection={<MonitorCog size={15} />}
          onClick={onOpenIsolatedWindow}
          size="xs"
          variant="light"
        >
          Isolated Window
        </Button>
      </Group>
      <Text c="dimmed" size="xs">
        {windowCount} window{windowCount === 1 ? "" : "s"} · {windowMode}
      </Text>
    </>
  );
}

function statusColor(status: RuntimeConnectionStatus): string {
  switch (status) {
    case "connected":
      return "green";
    case "connecting":
      return "blue";
    case "error":
      return "red";
    case "disconnected":
      return "gray";
  }
}

function sidecarStatusColor(status: ManagedSidecarStatus): string {
  switch (status) {
    case "running":
      return "green";
    case "starting":
    case "stopping":
      return "blue";
    case "error":
      return "red";
    case "stopped":
      return "gray";
  }
}
