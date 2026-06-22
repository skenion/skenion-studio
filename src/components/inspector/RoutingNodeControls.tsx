import { Stack, Text, TextInput } from "@mantine/core";
import type { DisplayGraphNodeV01 } from "../../graph/patchLibrary";
import {
  isRoutingCapableObjectNode,
  readReceiveNameParam,
  readSendNameParam
} from "../../graph/controlRouting";

export interface RoutingNodeControlsProps {
  node: DisplayGraphNodeV01;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}

export function RoutingNodeControls({ node, onSetNodeParam }: RoutingNodeControlsProps) {
  if (!isRoutingCapableObjectNode(node)) {
    return null;
  }

  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Routing
      </Text>
      <TextInput
        label="Send name"
        onChange={(event) => onSetNodeParam(node.id, "sendName", event.currentTarget.value)}
        placeholder="Optional typed channel name"
        size="xs"
        value={readSendNameParam(node)}
      />
      <TextInput
        label="Receive name"
        onChange={(event) => onSetNodeParam(node.id, "receiveName", event.currentTarget.value)}
        placeholder="Optional typed channel name"
        size="xs"
        value={readReceiveNameParam(node)}
      />
      <Text c="dimmed" size="xs">
        Routing names are graph params. Runtime clicks, sliders, toggles, and message events do not create graph patches.
      </Text>
    </Stack>
  );
}
