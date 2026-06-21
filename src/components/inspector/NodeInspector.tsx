import { Divider, Group, Stack, Text } from "@mantine/core";
import { BookOpen, Trash2 } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { getBuiltinNodeHelp, getBuiltinNodeHelpGraph } from "@skenion/contracts";
import type { GraphFragmentV02, GraphNodeV01, ShaderDiagnosticV01 } from "@skenion/contracts";
import type { RuntimeGeneratedShaderResponse } from "../../runtime/types";
import type { GraphFragmentBuildResult } from "../../graph/fragmentClipboard";
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
import { isRoutingCapableObjectNode } from "../../graph/controlRouting";
import { Button } from "../core/Button/Button";

export function NodeInspector({
  graphLocked = false,
  node,
  onRemoveNode,
  onLoadGeneratedShader,
  onHelpClipboardWriteError,
  onHelpCopyFragment,
  onHelpCopyFragmentError,
  onImportAsset,
  onOpenHelpGraph,
  onSetNodeParam,
  onSyncShaderInputs,
  generatedShader,
  generatedShaderBusy,
  runtimeAssetImportBusy,
  runtimeAssetImportEnabled,
  runtimeShaderDiagnostics
}: {
  generatedShader?: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy?: boolean;
  graphLocked?: boolean;
  node: GraphNodeV01;
  runtimeShaderDiagnostics?: ShaderDiagnosticV01[];
  onLoadGeneratedShader?: () => void;
  onHelpClipboardWriteError?: (message: string) => void;
  onHelpCopyFragment?: (fragment: GraphFragmentV02, result: GraphFragmentBuildResult) => void;
  onHelpCopyFragmentError?: (message: string) => void;
  onImportAsset?: (node: GraphNodeV01, file: File) => Promise<void>;
  onOpenHelpGraph?: (nodeKind: string) => void;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
  runtimeAssetImportBusy: boolean;
  runtimeAssetImportEnabled: boolean;
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
  const hasRoutingSettings = isRoutingCapableObjectNode(node);
  const objectSettingBlocks: ReactNode[] = [];
  const addObjectSettingBlock = (key: string, content: ReactNode) => {
    objectSettingBlocks.push(
      <Fragment key={key}>
        {objectSettingBlocks.length > 0 ? <Divider /> : null}
        {content}
      </Fragment>
    );
  };

  if (hasRoutingSettings) {
    addObjectSettingBlock("routing", <RoutingNodeControls node={node} onSetNodeParam={onSetNodeParam} />);
  }

  if (isPanelControl) {
    addObjectSettingBlock(
      "panel-control",
      <PanelControlInspector
        node={node}
        onSetNodeParam={onSetNodeParam}
      />
    );
  }

  if (isAssetNode) {
    addObjectSettingBlock(
      "asset",
      <AssetControls
        busy={runtimeAssetImportBusy}
        enabled={runtimeAssetImportEnabled}
        node={node}
        onImportAsset={onImportAsset}
      />
    );
  }

  if (clearColor) {
    addObjectSettingBlock(
      "clear-color",
      <ClearColorControls
        color={clearColor}
        onChange={(color) => onSetNodeParam(node.id, "color", color)}
      />
    );
  }

  if (floatValue !== null) {
    addObjectSettingBlock(
      "float",
      <FloatValueControls
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
        representation={floatRepresentation!}
        value={floatValue}
      />
    );
  }

  if (intValue !== null) {
    addObjectSettingBlock(
      "integer",
      <IntegerValueControls
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
        representation={intRepresentation!}
        value={intValue}
      />
    );
  }

  if (uintValue !== null) {
    addObjectSettingBlock(
      "unsigned-integer",
      <UnsignedIntegerValueControls
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
        representation={uintRepresentation!}
        value={uintValue}
      />
    );
  }

  if (boolValue !== null) {
    addObjectSettingBlock(
      "boolean",
      <BooleanValueControls
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        value={boolValue}
      />
    );
  }

  if (toggleValue !== null) {
    addObjectSettingBlock(
      "toggle",
      <BooleanValueControls
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        title="Toggle Graph Param"
        value={toggleValue}
      />
    );
  }

  if (stringValue !== null) {
    addObjectSettingBlock(
      "string",
      <StringValueControls
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        value={stringValue}
      />
    );
  }

  if (messageValue !== null) {
    addObjectSettingBlock(
      "message",
      <StringValueControls
        label="Message"
        onChange={(value) => onSetNodeParam(node.id, "value", value)}
        title="Message Graph Param"
        value={messageValue}
      />
    );
  }

  if (commentText !== null) {
    addObjectSettingBlock(
      "comment",
      <CommentControls
        onChange={(text) => onSetNodeParam(node.id, "text", text)}
        text={commentText}
      />
    );
  }

  if (colorRgba) {
    addObjectSettingBlock(
      "color-rgba",
      <ColorRgbaControls
        color={colorRgba}
        colorSpace={colorSpace!}
        onChange={(color) => onSetNodeParam(node.id, "value", color)}
        onColorSpaceChange={(nextColorSpace) => onSetNodeParam(node.id, "colorSpace", nextColorSpace)}
        onRepresentationChange={(representation) => onSetNodeParam(node.id, "representation", representation)}
        representation={colorRepresentation!}
      />
    );
  }

  if (shaderSource !== null) {
    addObjectSettingBlock(
      "fullscreen-shader",
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
    );
  }

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
              size="compact-sm"
              variant="light"
            >
              Help
            </Button>
          ) : null}
          <Button
            disabled={graphLocked}
            intent="danger"
            leftSection={<Trash2 size={15} />}
            onClick={() => onRemoveNode(node)}
            size="compact-sm"
          >
            Delete
          </Button>
        </Group>
      </Group>

      {help && helpOpen ? (
        <NodeHelp
          help={help}
          helpGraph={helpGraph}
          onClipboardWriteError={onHelpClipboardWriteError}
          onCopyFragment={onHelpCopyFragment}
          onCopyFragmentError={onHelpCopyFragmentError}
          onOpenAsEditableCopy={helpGraph && onOpenHelpGraph ? () => onOpenHelpGraph(node.kind) : undefined}
        />
      ) : null}

      {objectSettingBlocks.length > 0 ? (
        <>
          <Divider />
          <Stack gap="md">
            {objectSettingBlocks}
          </Stack>
        </>
      ) : null}

      <PortTable node={node} />

    </Stack>
  );
}
