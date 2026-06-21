import { Group, NumberInput, Text } from "@mantine/core";
import { Play, Route, ShieldCheck } from "lucide-react";
import { Button } from "../core/Button/Button";

interface RuntimeStatelessToolsPanelProps {
  busyAction: string | null;
  connected: boolean;
  frames: number;
  onFramesChange: (frames: number) => void;
  onPlan: () => void;
  onRun: () => void;
  onValidate: () => void;
}

export function RuntimeStatelessToolsPanel({
  busyAction,
  connected,
  frames,
  onFramesChange,
  onPlan,
  onRun,
  onValidate
}: RuntimeStatelessToolsPanelProps) {
  return (
    <>
      <NumberInput
        aria-label="Dummy execution frames"
        clampBehavior="strict"
        disabled={!connected || busyAction !== null}
        label="Frames"
        max={120}
        min={1}
        onChange={(value) => onFramesChange(typeof value === "number" ? value : 1)}
        size="xs"
        value={frames}
      />

      <Text c="dimmed" size="xs">
        Stateless Tools
      </Text>

      <Group gap="xs" grow>
        <Button
          disabled={!connected}
          leftSection={<ShieldCheck size={15} />}
          loading={busyAction === "validate"}
          onClick={onValidate}
          size="xs"
          variant="subtle"
        >
          Validate Payload
        </Button>
        <Button
          disabled={!connected}
          leftSection={<Route size={15} />}
          loading={busyAction === "plan"}
          onClick={onPlan}
          size="xs"
          variant="subtle"
        >
          Plan Payload
        </Button>
      </Group>

      <Button
        disabled={!connected}
        leftSection={<Play size={15} />}
        loading={busyAction === "run"}
        onClick={onRun}
        size="xs"
        variant="subtle"
      >
        Run Payload
      </Button>
    </>
  );
}
