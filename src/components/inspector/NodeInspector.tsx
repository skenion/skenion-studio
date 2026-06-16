import { Button, Divider, Group, Stack, Text } from "@mantine/core";
import { Trash2 } from "lucide-react";
import type { GraphNodeV01 } from "@skenion/contracts";
import { ClearColorControls } from "./ClearColorControls";
import { FloatValueControls } from "./FloatValueControls";
import { FullscreenShaderControls } from "./FullscreenShaderControls";
import { PortTable } from "./PortTable";
import {
  isClearColorNode,
  readClearColorParam
} from "../../graph/clearColor";
import {
  isFloatValueNode,
  readFloatValueParam
} from "../../graph/floatValue";
import {
  DEFAULT_FULLSCREEN_SHADER_SOURCE,
  isFullscreenShaderNode,
  readShaderLanguageParam,
  readShaderSourceParam
} from "../../graph/fullscreenShader";

export function NodeInspector({
  node,
  onRemoveNode,
  onSetNodeParam
}: {
  node: GraphNodeV01;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}) {
  const clearColor = isClearColorNode(node) ? readClearColorParam(node) : null;
  const floatValue = isFloatValueNode(node) ? readFloatValueParam(node) : null;
  const shaderSource = isFullscreenShaderNode(node) ? readShaderSourceParam(node) : null;
  const shaderLanguage = isFullscreenShaderNode(node) ? readShaderLanguageParam(node) : null;

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800}>{String(node.params.label ?? node.id)}</Text>
          <Text c="dimmed" size="xs">
            {node.kind}@{node.kindVersion}
          </Text>
        </div>
        <Button
          color="red"
          leftSection={<Trash2 size={15} />}
          onClick={() => onRemoveNode(node)}
          radius="sm"
          size="compact-sm"
          variant="light"
        >
          Delete
        </Button>
      </Group>

      <PortTable node={node} />

      {clearColor ? (
        <>
          <Divider />
          <ClearColorControls
            color={clearColor}
            onChange={(color) => onSetNodeParam(node.id, "color", color)}
          />
        </>
      ) : null}

      {floatValue !== null ? (
        <>
          <Divider />
          <FloatValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            value={floatValue}
          />
        </>
      ) : null}

      {shaderSource !== null ? (
        <>
          <Divider />
          <FullscreenShaderControls
            language={shaderLanguage ?? "unsupported"}
            onResetSource={() => onSetNodeParam(node.id, "source", DEFAULT_FULLSCREEN_SHADER_SOURCE)}
            onSourceChange={(source) => onSetNodeParam(node.id, "source", source)}
            source={shaderSource}
          />
        </>
      ) : null}
    </Stack>
  );
}
