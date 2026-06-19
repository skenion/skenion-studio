import type { GraphNodeV01 } from "@skenion/contracts";
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { readCommentTextParam } from "../../graph/commentNode";
import { FLOAT_VALUE_NODE_KIND, readFloatRepresentationParam, readFloatValueParam } from "../../graph/floatValue";
import { INT_VALUE_NODE_KIND, readIntRepresentationParam, readIntValueParam } from "../../graph/intValue";
import { BOOL_VALUE_NODE_KIND, readBoolValueParam } from "../../graph/boolValue";
import { COLOR_NODE_KIND, readColorRepresentationParam, readColorRgbaParam, readColorSpaceParam } from "../../graph/colorRgba";
import { STRING_VALUE_NODE_KIND, readStringValueParam } from "../../graph/stringValue";
import { UINT_VALUE_NODE_KIND, readUIntRepresentationParam, readUIntValueParam } from "../../graph/uintValue";
import { MESSAGE_NODE_KIND, readMessageValueParam } from "../../graph/messageNode";
import {
  isBangControlNode,
  isSliderFloatNode,
  isToggleControlNode,
  readPanelLabelParam,
  readSliderFloatParams,
  readToggleControlValue
} from "../../graph/panelControls";
import { VIDEO_ASSET_NODE_KIND, readVideoAssetParams } from "../../graph/videoAsset";
import { PANEL_NODE_KIND, readPanelParams } from "../../graph/panelNode";
import type { NodeCardView, NodePortHandleRenderer, NodePortView } from "../node/nodeTypes";
import type { RuntimeControlMessage, RuntimeControlValue } from "../../runtime/types";
import { bangControlMessage, controlMessageFromValue } from "../../runtime/controlMessage";
import { beginDeferredHorizontalNumberDrag } from "./deferredPointerDrag";
import styles from "./ObjectNodeRenderer.module.css";
import socketStyles from "../node/PortSocket.module.css";

export interface ObjectNodeRendererProps {
  card: NodeCardView;
  node: GraphNodeV01;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  runtimeControlEnabled?: boolean;
  runtimeControlValue?: RuntimeControlValue;
  selected?: boolean;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
}

export function ObjectNodeRenderer({
  card,
  node,
  onObjectControl,
  onObjectLiveControl,
  runtimeControlEnabled = false,
  runtimeControlValue,
  selected,
  renderInputHandle,
  renderOutputHandle
}: ObjectNodeRendererProps) {
  if (node.kind === "core.comment") {
    return (
      <ObjectBox
        className={styles.commentObject}
        inputPorts={card.inputs}
        renderInputHandle={renderInputHandle}
        selected={selected}
      >
        <div className={styles.commentText}>{readCommentTextParam(node) || "Comment"}</div>
      </ObjectBox>
    );
  }

  if (node.kind === PANEL_NODE_KIND) {
    const panel = readPanelParams(node);
    return (
      <ObjectBox
        className={styles.panelObject}
        inputPorts={card.inputs}
        renderInputHandle={renderInputHandle}
        selected={selected}
        style={{ background: panel.color }}
      >
        {panel.label ? <div className={styles.panelTitle}>{panel.label}</div> : null}
      </ObjectBox>
    );
  }

  if (node.kind === MESSAGE_NODE_KIND) {
    return (
      <ObjectBox
        className={styles.messageObject}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        onActivate={(event) => {
          event.stopPropagation();
          if (!runtimeControlEnabled) {
            return;
          }
          onObjectControl?.(node.id, "bang", bangControlMessage());
        }}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      >
        {readMessageValueParam(node) || "message"}
      </ObjectBox>
    );
  }

  if (isBangControlNode(node)) {
    return (
      <ObjectBox
        className={styles.bangObject}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        onActivate={(event) => {
          event.stopPropagation();
          if (!runtimeControlEnabled) {
            return;
          }
          onObjectControl?.(node.id, "in", bangControlMessage());
        }}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        role="button"
        selected={selected}
      >
        <span className={styles.bangDot} />
        <span>{readPanelLabelParam(node)}</span>
      </ObjectBox>
    );
  }

  const toggleNode = node as GraphNodeV01;
  if (isToggleControlNode(toggleNode)) {
    const value = controlBoolValue(runtimeControlValue) ?? readToggleControlValue(toggleNode);
    const nodeId = toggleNode.id;
    return (
      <ObjectBox
        className={styles.toggleObject}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        onActivate={(event) => {
          event.stopPropagation();
          if (!runtimeControlEnabled) {
            return;
          }
          onObjectControl?.(nodeId, "bang", bangControlMessage());
        }}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        role="button"
        selected={selected}
      >
        <span className={[styles.toggleSwitch, value ? styles.toggleOn : ""].filter(Boolean).join(" ")} />
        <span>{readPanelLabelParam(toggleNode)}</span>
      </ObjectBox>
    );
  }

  const sliderNode = node as GraphNodeV01;
  if (isSliderFloatNode(sliderNode)) {
    return (
      <SliderControlObject
        card={card}
        node={sliderNode}
        onLiveControl={onObjectLiveControl ?? onObjectControl}
        runtimeControlEnabled={runtimeControlEnabled}
        runtimeControlValue={runtimeControlValue}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      />
    );
  }

  const valueNode = node as GraphNodeV01;
  if (isValueObject(valueNode)) {
    return (
      <ObjectBox
        className={styles.valueObject}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      >
        <span className={styles.valueKind}>{valueKindLabel(valueNode)}</span>
        {valueNode.kind === FLOAT_VALUE_NODE_KIND ? (
          <FloatValueDragObject
            node={valueNode}
            onLiveControl={onObjectLiveControl ?? onObjectControl}
            runtimeControlEnabled={runtimeControlEnabled}
            runtimeControlValue={runtimeControlValue}
          />
        ) : (
          <span className={styles.valueText}>{valueLabel(valueNode, runtimeControlValue)}</span>
        )}
        <span className={styles.representationBadge}>{representationLabel(valueNode)}</span>
        <RoutingBadges node={valueNode} />
      </ObjectBox>
    );
  }

  const fallbackNode = node as GraphNodeV01;
  if (fallbackNode.kind === VIDEO_ASSET_NODE_KIND) {
    const asset = readVideoAssetParams(fallbackNode);
    return (
      <ObjectBox
        className={styles.assetObject}
        inputPorts={card.inputs}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      >
        <span className={styles.assetKind}>asset.video</span>
        <span className={styles.assetName}>{asset.name || "Choose video asset"}</span>
        <span className={styles.assetRef}>{asset.assetRef || "missing assetRef"}</span>
      </ObjectBox>
    );
  }

  return (
    <ObjectBox
      className={styles.genericObject}
      inputPorts={card.inputs}
      outputPorts={card.outputs}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      selected={selected}
      style={{ "--node-accent": card.accentColor ?? "#868e96" } as CSSProperties}
    >
      <span className={styles.genericLabel}>{card.label}</span>
      <span className={styles.genericKind}>{fallbackNode.kind}</span>
    </ObjectBox>
  );
}

function SliderControlObject({
  card,
  node,
  onLiveControl,
  runtimeControlEnabled,
  runtimeControlValue,
  renderInputHandle,
  renderOutputHandle,
  selected
}: {
  card: NodeCardView;
  node: GraphNodeV01;
  onLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  runtimeControlEnabled: boolean;
  runtimeControlValue?: RuntimeControlValue;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  selected?: boolean;
}) {
  const slider = readSliderFloatParams(node);
  const displayValue = controlFloatValue(runtimeControlValue) ?? slider.value;
  const [value, setValue] = useState(displayValue);

  useEffect(() => {
    setValue(displayValue);
  }, [displayValue]);

  const range = slider.max - slider.min;
  const percent = range === 0 ? 0 : Math.min(100, Math.max(0, ((value - slider.min) / range) * 100));

  return (
    <ObjectBox
      className={styles.sliderObject}
      disabled={!runtimeControlEnabled}
      inputPorts={card.inputs}
      outputPorts={card.outputs}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      selected={selected}
    >
      <div className={styles.sliderLabel}>{slider.label}</div>
      <input
        aria-label={`${slider.label} runtime value`}
        className={[styles.sliderInput, "nodrag", "nopan"].join(" ")}
        disabled={!runtimeControlEnabled}
        max={slider.max}
        min={slider.min}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (!Number.isFinite(nextValue)) {
            return;
          }
          if (!runtimeControlEnabled) {
            return;
          }
          setValue(nextValue);
          onLiveControl?.(
            node.id,
            "in",
            controlMessageFromValue({ type: "float", representation: "f32", value: nextValue })
          );
        }}
        onPointerDown={(event) => event.stopPropagation()}
        step={slider.step}
        style={{ "--slider-percent": `${percent}%` } as CSSProperties}
        type="range"
        value={value}
      />
      <div className={styles.sliderValue}>{formatValue(value)}</div>
    </ObjectBox>
  );
}

function ObjectBox({
  children,
  className,
  disabled = false,
  inputPorts = [],
  onActivate,
  outputPorts = [],
  renderInputHandle,
  renderOutputHandle,
  role,
  selected,
  style
}: {
  children: ReactNode;
  className: string;
  disabled?: boolean;
  inputPorts?: NodePortView[];
  onActivate?: (event: MouseEvent<HTMLDivElement>) => void;
  outputPorts?: NodePortView[];
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  role?: "button";
  selected?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-disabled={disabled || undefined}
      className={[styles.objectNode, className, selected ? styles.selected : "", disabled ? styles.disabled : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={disabled ? undefined : onActivate}
      role={role}
      style={style}
      tabIndex={role === "button" && !disabled ? 0 : undefined}
    >
      {renderInputHandle && inputPorts.length > 0 ? (
        <div className={[styles.handleList, styles.inputHandles].join(" ")}>
          {inputPorts.map((port) => (
            <div className={socketStyles.slot} key={port.id} title={`${port.id}: ${port.typeLabel}`}>
              {renderInputHandle(port, "input")}
            </div>
          ))}
        </div>
      ) : null}
      <div className={styles.content}>{children}</div>
      {renderOutputHandle && outputPorts.length > 0 ? (
        <div className={[styles.handleList, styles.outputHandles].join(" ")}>
          {outputPorts.map((port) => (
            <div className={socketStyles.slot} key={port.id} title={`${port.id}: ${port.typeLabel}`}>
              {renderOutputHandle(port, "output")}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RoutingBadges({ node }: { node: GraphNodeV01 }) {
  const send = typeof node.params.sendName === "string" && node.params.sendName.trim() ? node.params.sendName : null;
  const receive = typeof node.params.receiveName === "string" && node.params.receiveName.trim() ? node.params.receiveName : null;
  if (!send && !receive) {
    return null;
  }
  return (
    <span className={styles.routingBadges}>
      {send ? <span title={`send ${send}`}>s {send}</span> : null}
      {receive ? <span title={`receive ${receive}`}>r {receive}</span> : null}
    </span>
  );
}

function isValueObject(node: GraphNodeV01): boolean {
  return [
    FLOAT_VALUE_NODE_KIND,
    INT_VALUE_NODE_KIND,
    UINT_VALUE_NODE_KIND,
    BOOL_VALUE_NODE_KIND,
    COLOR_NODE_KIND,
    STRING_VALUE_NODE_KIND
  ].includes(node.kind);
}

function valueKindLabel(node: GraphNodeV01): string {
  if (node.kind === FLOAT_VALUE_NODE_KIND) return "float";
  if (node.kind === INT_VALUE_NODE_KIND) return "int";
  if (node.kind === UINT_VALUE_NODE_KIND) return "uint";
  if (node.kind === BOOL_VALUE_NODE_KIND) return "bool";
  if (node.kind === COLOR_NODE_KIND) return "color";
  return "string";
}

function valueLabel(node: GraphNodeV01, runtimeControlValue?: RuntimeControlValue): string {
  if (node.kind === FLOAT_VALUE_NODE_KIND) {
    return formatValue(controlFloatValue(runtimeControlValue) ?? readFloatValueParam(node));
  }
  if (node.kind === INT_VALUE_NODE_KIND) {
    return String(controlIntValue(runtimeControlValue) ?? readIntValueParam(node));
  }
  if (node.kind === UINT_VALUE_NODE_KIND) {
    return String(controlUIntValue(runtimeControlValue) ?? readUIntValueParam(node));
  }
  if (node.kind === BOOL_VALUE_NODE_KIND) {
    return (controlBoolValue(runtimeControlValue) ?? readBoolValueParam(node)) ? "true" : "false";
  }
  if (node.kind === COLOR_NODE_KIND) {
    return (controlColorValue(runtimeControlValue) ?? readColorRgbaParam(node)).map(formatValue).join(" ");
  }
  return controlStringValue(runtimeControlValue) ?? (readStringValueParam(node) || "\"\"");
}

function representationLabel(node: GraphNodeV01): string {
  if (node.kind === FLOAT_VALUE_NODE_KIND) return readFloatRepresentationParam(node);
  if (node.kind === INT_VALUE_NODE_KIND) return readIntRepresentationParam(node);
  if (node.kind === UINT_VALUE_NODE_KIND) return readUIntRepresentationParam(node);
  if (node.kind === COLOR_NODE_KIND) return `${readColorRepresentationParam(node)} ${readColorSpaceParam(node)}`;
  return "";
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function FloatValueDragObject({
  node,
  onLiveControl,
  runtimeControlEnabled,
  runtimeControlValue
}: {
  node: GraphNodeV01;
  onLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  runtimeControlEnabled: boolean;
  runtimeControlValue?: RuntimeControlValue;
}) {
  const displayValue = controlFloatValue(runtimeControlValue) ?? readFloatValueParam(node);
  const [draftValue, setDraftValue] = useState(displayValue);

  useEffect(() => {
    setDraftValue(displayValue);
  }, [displayValue]);

  return (
    <button
      className={[styles.valueDrag, "nodrag", "nopan"].join(" ")}
      disabled={!runtimeControlEnabled}
      onPointerDown={(event) => {
        if (!runtimeControlEnabled) {
          return;
        }
        beginDeferredHorizontalNumberDrag({
          event,
          onCancel: () => setDraftValue(displayValue),
          onCommit: () => undefined,
          onPreview: (value) => {
            setDraftValue(value);
            onLiveControl?.(
              node.id,
              "in",
              controlMessageFromValue({ type: "float", representation: "f32", value })
            );
          },
          startValue: displayValue
        });
      }}
      title={
        runtimeControlEnabled
          ? "Drag horizontally to send a runtime value"
          : "Connect and load a Runtime session to send values"
      }
      type="button"
    >
      {formatValue(draftValue)}
    </button>
  );
}

function controlFloatValue(value?: RuntimeControlValue): number | null {
  return value?.type === "float" ? value.value : null;
}

function controlIntValue(value?: RuntimeControlValue): number | null {
  return value?.type === "int" ? value.value : null;
}

function controlUIntValue(value?: RuntimeControlValue): number | null {
  return value?.type === "uint" ? value.value : null;
}

function controlBoolValue(value?: RuntimeControlValue): boolean | null {
  return value?.type === "bool" ? value.value : null;
}

function controlColorValue(value?: RuntimeControlValue): [number, number, number, number] | null {
  return value?.type === "color" ? value.value : null;
}

function controlStringValue(value?: RuntimeControlValue): string | null {
  return value?.type === "string" ? value.value : null;
}
