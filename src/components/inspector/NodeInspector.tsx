import { Button, Divider, Group, Stack, Text } from "@mantine/core";
import { BookOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import type { GraphNodeV01, ShaderDiagnosticV01 } from "@skenion/contracts";
import type { RuntimeControlEventRequest, RuntimeGeneratedShaderResponse } from "../../runtime/types";
import { AssetControls } from "./AssetControls";
import { BooleanValueControls } from "./BooleanValueControls";
import { ClearColorControls } from "./ClearColorControls";
import { CommentControls } from "./CommentControls";
import { ColorRgbaControls } from "./ColorRgbaControls";
import { FloatValueControls } from "./FloatValueControls";
import { FullscreenShaderControls } from "./FullscreenShaderControls";
import { IntegerValueControls } from "./IntegerValueControls";
import { NodeHelp } from "./NodeHelp";
import { PanelControlInspector } from "./PanelControlInspector";
import { PortTable } from "./PortTable";
import { RoutingNodeControls } from "./RoutingNodeControls";
import { RuntimeControlValueControls } from "./RuntimeControlValueControls";
import { StringValueControls } from "./StringValueControls";
import { UnsignedIntegerValueControls } from "./UnsignedIntegerValueControls";
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
  readColorRepresentationParam,
  readColorRgbaParam,
  readColorSpaceParam
} from "../../graph/colorRgba";
import {
  isCommentNode,
  readCommentTextParam
} from "../../graph/commentNode";
import { runtimeControlValueForNode } from "../../graph/controlValue";
import {
  isFloatValueNode,
  readFloatRepresentationParam,
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
  readIntRepresentationParam,
  readIntValueParam
} from "../../graph/intValue";
import {
  isUIntValueNode,
  readUIntRepresentationParam,
  readUIntValueParam
} from "../../graph/uintValue";
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
import {
  isBangControlNode,
  isSliderFloatNode,
  isToggleControlNode
} from "../../graph/panelControls";
import { isVideoAssetNode } from "../../graph/videoAsset";

export function NodeInspector({
  graphLocked = false,
  node,
  onRemoveNode,
  onLoadGeneratedShader,
  onImportAsset,
  onOpenHelpGraph,
  onSendRuntimeControl,
  onSetNodeParam,
  onSyncShaderInputs,
  generatedShader,
  generatedShaderBusy,
  runtimeAssetImportBusy,
  runtimeAssetImportEnabled,
  runtimeControlBusy,
  runtimeControlEnabled,
  runtimeShaderDiagnostics
}: {
  generatedShader?: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy?: boolean;
  graphLocked?: boolean;
  node: GraphNodeV01;
  runtimeShaderDiagnostics?: ShaderDiagnosticV01[];
  onLoadGeneratedShader?: () => void;
  onImportAsset?: (node: GraphNodeV01, file: File) => Promise<void>;
  onOpenHelpGraph?: (nodeKind: string) => void;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
  runtimeAssetImportBusy: boolean;
  runtimeAssetImportEnabled: boolean;
  runtimeControlBusy: boolean;
  runtimeControlEnabled: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const clearColor = isClearColorNode(node) ? readClearColorParam(node) : null;
  const commentText = isCommentNode(node) ? readCommentTextParam(node) : null;
  const isPanelControl = isBangControlNode(node) || isSliderFloatNode(node) || isToggleControlNode(node);
  const colorRgba = isColorRgbaNode(node) ? readColorRgbaParam(node) : null;
  const colorRepresentation = isColorRgbaNode(node) ? readColorRepresentationParam(node) : null;
  const colorSpace = isColorRgbaNode(node) ? readColorSpaceParam(node) : null;
  const floatValue = isFloatValueNode(node) && !isPanelControl ? readFloatValueParam(node) : null;
  const floatRepresentation = isFloatValueNode(node) && !isPanelControl ? readFloatRepresentationParam(node) : null;
  const intValue = isIntValueNode(node) ? readIntValueParam(node) : null;
  const intRepresentation = isIntValueNode(node) ? readIntRepresentationParam(node) : null;
  const uintValue = isUIntValueNode(node) ? readUIntValueParam(node) : null;
  const uintRepresentation = isUIntValueNode(node) ? readUIntRepresentationParam(node) : null;
  const toggleValue = isToggleNode(node) ? readToggleParam(node) : null;
  const boolValue = isBoolValueNode(node) && toggleValue === null ? readBoolValueParam(node) : null;
  const stringValue = isStringValueNode(node) ? readStringValueParam(node) : null;
  const messageValue = isMessageNode(node) ? readMessageValueParam(node) : null;
  const isAssetNode = isVideoAssetNode(node);
  const runtimeControlValue = isPanelControl ? null : runtimeControlValueForNode(node);
  const runtimeControlActions = runtimeControlActionsForNode(node);
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
            disabled={graphLocked}
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

      <RoutingNodeControls node={node} onSetNodeParam={onSetNodeParam} />

      {isPanelControl ? (
        <>
          <Divider />
          <PanelControlInspector
            busy={runtimeControlBusy}
            enabled={runtimeControlEnabled}
            node={node}
            onSend={onSendRuntimeControl}
            onSetNodeParam={onSetNodeParam}
          />
        </>
      ) : null}

      {isAssetNode ? (
        <>
          <Divider />
            <AssetControls
            busy={runtimeAssetImportBusy}
            enabled={runtimeAssetImportEnabled}
            node={node}
            onImportAsset={onImportAsset}
          />
        </>
      ) : null}

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
            onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
            representation={floatRepresentation!}
            value={floatValue}
          />
        </>
      ) : null}

      {intValue !== null ? (
        <>
          <Divider />
          <IntegerValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
            representation={intRepresentation!}
            value={intValue}
          />
        </>
      ) : null}

      {uintValue !== null ? (
        <>
          <Divider />
          <UnsignedIntegerValueControls
            onChange={(value) => onSetNodeParam(node.id, "value", value)}
            onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
            representation={uintRepresentation!}
            value={uintValue}
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
            colorSpace={colorSpace!}
            onChange={(color) => onSetNodeParam(node.id, "value", color)}
            onColorSpaceChange={(nextColorSpace) => onSetNodeParam(node.id, "colorSpace", nextColorSpace)}
            onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
            representation={colorRepresentation!}
          />
        </>
      ) : null}

      {runtimeControlValue ? (
        <>
          <Divider />
          <RuntimeControlValueControls
            availableActions={runtimeControlActions}
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

function runtimeControlActionsForNode(node: GraphNodeV01) {
  const hasHotInlet = hasInputPort(node, "in");
  return {
    in: hasHotInlet,
    set: hasHotInlet,
    bang: hasHotInlet
  };
}

function hasInputPort(node: GraphNodeV01, portId: string): boolean {
  return node.ports.some((port) => port.id === portId && port.direction === "input");
}
