import { Button, Divider, Group, Stack, Text } from "@mantine/core";
import { Trash2 } from "lucide-react";
import type { GraphNodeV01 } from "@skenion/contracts";
import type { RuntimeControlEventRequest } from "../../runtime/types";
import { BooleanValueControls } from "./BooleanValueControls";
import { ClearColorControls } from "./ClearColorControls";
import { ColorRgbaControls } from "./ColorRgbaControls";
import { FloatValueControls } from "./FloatValueControls";
import { FullscreenShaderControls } from "./FullscreenShaderControls";
import { IntegerValueControls } from "./IntegerValueControls";
import { PortTable } from "./PortTable";
import { RuntimeControlValueControls } from "./RuntimeControlValueControls";
import {
  isBoolValueNode,
  readBoolValueParam
} from "../../graph/boolValue";
import {
  isClearColorNode,
  readClearColorParam
} from "../../graph/clearColor";
import {
  isColorRgbaNode,
  readColorRgbaParam
} from "../../graph/colorRgba";
import { runtimeControlValueForNode } from "../../graph/controlValue";
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
import {
  isIntValueNode,
  readIntValueParam
} from "../../graph/intValue";

export function NodeInspector({
  node,
  onRemoveNode,
  onSendRuntimeControl,
  onSetNodeParam,
  runtimeControlBusy,
  runtimeControlEnabled
}: {
  node: GraphNodeV01;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  runtimeControlBusy: boolean;
  runtimeControlEnabled: boolean;
}) {
  const clearColor = isClearColorNode(node) ? readClearColorParam(node) : null;
  const colorRgba = isColorRgbaNode(node) ? readColorRgbaParam(node) : null;
  const floatValue = isFloatValueNode(node) ? readFloatValueParam(node) : null;
  const intValue = isIntValueNode(node) ? readIntValueParam(node) : null;
  const boolValue = isBoolValueNode(node) ? readBoolValueParam(node) : null;
  const runtimeControlValue = runtimeControlValueForNode(node);
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

      {intValue !== null ? (
        <>
          <Divider />
          <IntegerValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            value={intValue}
          />
        </>
      ) : null}

      {boolValue !== null ? (
        <>
          <Divider />
          <BooleanValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            value={boolValue}
          />
        </>
      ) : null}

      {colorRgba ? (
        <>
          <Divider />
          <ColorRgbaControls
            color={colorRgba}
            onChange={(color) => onSetNodeParam(node.id, "value", color)}
          />
        </>
      ) : null}

      {runtimeControlValue ? (
        <>
          <Divider />
          <RuntimeControlValueControls
            busy={runtimeControlBusy}
            enabled={runtimeControlEnabled}
            nodeId={node.id}
            onSend={onSendRuntimeControl}
            value={runtimeControlValue}
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
