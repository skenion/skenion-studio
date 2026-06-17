import { Button, Divider, Group, Stack, Text } from "@mantine/core";
import { BookOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import type { GraphNodeV01, ShaderDiagnosticV01 } from "@skenion/contracts";
import type { RuntimeControlEventRequest, RuntimeGeneratedShaderResponse } from "../../runtime/types";
import { BooleanValueControls } from "./BooleanValueControls";
import { ClearColorControls } from "./ClearColorControls";
import { CommentControls } from "./CommentControls";
import { ColorRgbaControls } from "./ColorRgbaControls";
import { FloatValueControls } from "./FloatValueControls";
import { FullscreenShaderControls } from "./FullscreenShaderControls";
import { IntegerValueControls } from "./IntegerValueControls";
import { NodeHelp } from "./NodeHelp";
import { PortTable } from "./PortTable";
import { RuntimeControlValueControls } from "./RuntimeControlValueControls";
import { StringValueControls } from "./StringValueControls";
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
import {
  isCommentNode,
  readCommentTextParam
} from "../../graph/commentNode";
import { runtimeControlValueForNode } from "../../graph/controlValue";
import {
  isFloatValueNode,
  readFloatValueParam
} from "../../graph/floatValue";
import {
  DEFAULT_FULLSCREEN_SHADER_SOURCE,
  analyzeFullscreenShaderInterface,
  fullscreenShaderPortsAreSynced,
  isFullscreenShaderNode,
  readShaderLanguageParam,
  readShaderSourceParam
} from "../../graph/fullscreenShader";
import {
  isIntValueNode,
  readIntValueParam
} from "../../graph/intValue";
import {
  isMessageNode,
  readMessageValueParam
} from "../../graph/messageNode";
import {
  isStringValueNode,
  readStringValueParam
} from "../../graph/stringValue";
import {
  isToggleNode,
  readToggleParam
} from "../../graph/toggleValue";

export function NodeInspector({
  node,
  onRemoveNode,
  onLoadGeneratedShader,
  onOpenHelpGraph,
  onSendRuntimeControl,
  onSetNodeParam,
  onSyncShaderInputs,
  generatedShader,
  generatedShaderBusy,
  runtimeControlBusy,
  runtimeControlEnabled,
  runtimeShaderDiagnostics
}: {
  generatedShader?: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy?: boolean;
  node: GraphNodeV01;
  runtimeShaderDiagnostics?: ShaderDiagnosticV01[];
  onLoadGeneratedShader?: () => void;
  onOpenHelpGraph?: (nodeKind: string) => void;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
  runtimeControlBusy: boolean;
  runtimeControlEnabled: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const clearColor = isClearColorNode(node) ? readClearColorParam(node) : null;
  const commentText = isCommentNode(node) ? readCommentTextParam(node) : null;
  const colorRgba = isColorRgbaNode(node) ? readColorRgbaParam(node) : null;
  const floatValue = isFloatValueNode(node) ? readFloatValueParam(node) : null;
  const intValue = isIntValueNode(node) ? readIntValueParam(node) : null;
  const boolValue = isBoolValueNode(node) ? readBoolValueParam(node) : null;
  const stringValue = isStringValueNode(node) ? readStringValueParam(node) : null;
  const toggleValue = isToggleNode(node) ? readToggleParam(node) : null;
  const messageValue = isMessageNode(node) ? readMessageValueParam(node) : null;
  const runtimeControlValue = runtimeControlValueForNode(node);
  const runtimeControlPorts = runtimeControlPortsForNode(node);
  const shaderSource = isFullscreenShaderNode(node) ? readShaderSourceParam(node) : null;
  const shaderLanguage = isFullscreenShaderNode(node) ? readShaderLanguageParam(node) : null;
  const shaderAnalysis = shaderSource !== null
    ? analyzeFullscreenShaderInterface(shaderSource, shaderLanguage ?? "unsupported")
    : null;
  const shaderInterfaceSynced = shaderSource !== null
    ? fullscreenShaderPortsAreSynced(node.ports, shaderSource, shaderLanguage ?? "unsupported")
    : false;
  const help = getBuiltinNodeHelp(node.kind);
  const helpGraph = getBuiltinNodeHelpGraph(node.kind);

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800}>{String(node.params.label ?? node.id)}</Text>
          <Text c="dimmed" size="xs">
            {node.kind}@{node.kindVersion}
          </Text>
        </div>
        <Group gap="xs" wrap="nowrap">
          {help ? (
            <Button
              leftSection={<BookOpen size={15} />}
              onClick={() => setHelpOpen((open) => !open)}
              radius="sm"
              size="compact-sm"
              variant="light"
            >
              Help
            </Button>
          ) : null}
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
      </Group>

      {help && helpOpen ? (
        <NodeHelp
          help={help}
          helpGraph={helpGraph}
          onOpenAsNewGraph={helpGraph && onOpenHelpGraph ? () => onOpenHelpGraph(node.kind) : undefined}
        />
      ) : null}

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

      {toggleValue !== null ? (
        <>
          <Divider />
          <BooleanValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            title="Toggle Graph Param"
            value={toggleValue}
          />
        </>
      ) : null}

      {stringValue !== null ? (
        <>
          <Divider />
          <StringValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            value={stringValue}
          />
        </>
      ) : null}

      {messageValue !== null ? (
        <>
          <Divider />
          <StringValueControls
            label="Message"
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            title="Message Graph Param"
            value={messageValue}
          />
        </>
      ) : null}

      {commentText !== null ? (
        <>
          <Divider />
          <CommentControls
            onChange={(text) => onSetNodeParam(node.id, "text", text)}
            text={commentText}
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
            availablePorts={runtimeControlPorts}
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
            analysis={shaderAnalysis!}
            generatedShader={generatedShader}
            generatedShaderBusy={generatedShaderBusy}
            interfaceSynced={shaderInterfaceSynced}
            language={shaderLanguage ?? "unsupported"}
            onAnalyze={() => undefined}
            onLoadGeneratedShader={onLoadGeneratedShader}
            onResetSource={() => onSetNodeParam(node.id, "source", DEFAULT_FULLSCREEN_SHADER_SOURCE)}
            onSourceChange={(source) => onSetNodeParam(node.id, "source", source)}
            onSyncInputs={() => onSyncShaderInputs(node.id, shaderSource)}
            runtimeDiagnostics={runtimeShaderDiagnostics}
            source={shaderSource}
          />
        </>
      ) : null}
    </Stack>
  );
}

function runtimeControlPortsForNode(node: GraphNodeV01) {
  return {
    in: hasInputPort(node, "in"),
    set: hasInputPort(node, "set"),
    bang: hasInputPort(node, "bang")
  };
}

function hasInputPort(node: GraphNodeV01, portId: string): boolean {
  return node.ports.some((port) => port.id === portId && port.direction === "input");
}
