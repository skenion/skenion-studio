import type { GraphNodeV01 } from "@skenion/contracts";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { readCommentTextParam } from "../../graph/commentNode";
import { FLOAT_VALUE_NODE_KIND, readFloatRepresentationParam, readFloatValueParam } from "../../graph/floatValue";
import { INT_VALUE_NODE_KIND, readIntRepresentationParam, readIntValueParam } from "../../graph/intValue";
import { BOOL_VALUE_NODE_KIND, readBoolValueParam } from "../../graph/boolValue";
import { COLOR_NODE_KIND, readColorRgbaParam } from "../../graph/colorRgba";
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
  runtimeControlPulseKey?: number;
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
  runtimeControlPulseKey = 0,
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
        onActivate={() => {
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
      <BangControlObject
        card={card}
        node={node}
        onObjectControl={onObjectControl}
        pulseKey={runtimeControlPulseKey}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        runtimeControlEnabled={runtimeControlEnabled}
        selected={selected}
      />
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
        onActivate={() => {
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
        {readPanelLabelParam(toggleNode) !== toggleNode.id ? (
          <span className={styles.toggleLabel}>{readPanelLabelParam(toggleNode)}</span>
        ) : null}
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
        <ValueObjectContent
          node={valueNode}
          onLiveControl={onObjectLiveControl ?? onObjectControl}
          runtimeControlEnabled={runtimeControlEnabled}
          runtimeControlValue={runtimeControlValue}
        />
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

function BangControlObject({
  card,
  node,
  onObjectControl,
  pulseKey,
  renderInputHandle,
  renderOutputHandle,
  runtimeControlEnabled,
  selected
}: {
  card: NodeCardView;
  node: GraphNodeV01;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  pulseKey: number;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  runtimeControlEnabled: boolean;
  selected?: boolean;
}) {
  const [active, setActive] = useState(false);
  const pulse = () => {
    setActive(true);
    window.setTimeout(() => setActive(false), 140);
  };

  useEffect(() => {
    if (pulseKey > 0) {
      pulse();
    }
  }, [pulseKey]);

  return (
    <ObjectBox
      className={styles.bangObject}
      disabled={!runtimeControlEnabled}
      inputPorts={card.inputs}
      onActivate={() => {
        if (!runtimeControlEnabled) {
          return;
        }
        pulse();
        onObjectControl?.(node.id, "in", bangControlMessage());
      }}
      outputPorts={card.outputs}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      role="button"
      selected={selected}
    >
      <span className={[styles.bangDot, active ? styles.bangActive : ""].filter(Boolean).join(" ")} />
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
  onActivate?: () => void;
  outputPorts?: NodePortView[];
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  role?: "button";
  selected?: boolean;
  style?: CSSProperties;
}) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);
  const skipClickRef = useRef(false);
  const activationThreshold = 4;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!onActivate || disabled || event.button !== 0) {
      pointerStartRef.current = null;
      return;
    }
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY
    };
    pointerMovedRef.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) {
      return;
    }
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance > activationThreshold) {
      pointerMovedRef.current = true;
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (onActivate && !disabled && pointerStartRef.current && !pointerMovedRef.current) {
      event.preventDefault();
      event.stopPropagation();
      skipClickRef.current = true;
      onActivate();
    }
    pointerStartRef.current = null;
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onActivate || disabled) {
      return;
    }
    if (skipClickRef.current) {
      skipClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (pointerMovedRef.current) {
      pointerMovedRef.current = false;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onActivate || disabled || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  };

  return (
    <div
      aria-disabled={disabled || undefined}
      className={[
        styles.objectNode,
        className,
        onActivate ? "nodrag" : "",
        onActivate ? "nopan" : "",
        selected ? styles.selected : "",
        disabled ? styles.disabled : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
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

function ValueObjectContent({
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
  if (node.kind === FLOAT_VALUE_NODE_KIND) {
    return (
      <NumericValueDragObject
        mode="float"
        node={node}
        onLiveControl={onLiveControl}
        runtimeControlEnabled={runtimeControlEnabled}
        runtimeControlValue={runtimeControlValue}
      />
    );
  }
  if (node.kind === INT_VALUE_NODE_KIND) {
    return (
      <NumericValueDragObject
        mode="int"
        node={node}
        onLiveControl={onLiveControl}
        runtimeControlEnabled={runtimeControlEnabled}
        runtimeControlValue={runtimeControlValue}
      />
    );
  }
  if (node.kind === UINT_VALUE_NODE_KIND) {
    return (
      <NumericValueDragObject
        mode="uint"
        node={node}
        onLiveControl={onLiveControl}
        runtimeControlEnabled={runtimeControlEnabled}
        runtimeControlValue={runtimeControlValue}
      />
    );
  }
  if (node.kind === BOOL_VALUE_NODE_KIND) {
    return <span className={styles.valueText}>{(controlBoolValue(runtimeControlValue) ?? readBoolValueParam(node)) ? "1" : "0"}</span>;
  }
  if (node.kind === COLOR_NODE_KIND) {
    const color = controlColorValue(runtimeControlValue) ?? readColorRgbaParam(node);
    return (
      <span className={styles.colorValue}>
        <span
          className={styles.colorSwatch}
          style={{ background: `rgba(${color.map((value, index) => index < 3 ? Math.round(value * 255) : value).join(",")})` }}
        />
        <span>{color.map(formatValue).join(" ")}</span>
      </span>
    );
  }
  return <span className={styles.valueText}>{controlStringValue(runtimeControlValue) ?? (readStringValueParam(node) || "\"\"")}</span>;
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatFloatAtom(value: number): string {
  if (!Number.isFinite(value)) {
    return "0.";
  }
  return Number.isInteger(value) ? `${value}.` : formatValue(value);
}

function formatIntegerAtom(value: number): string {
  return String(Math.trunc(Number.isFinite(value) ? value : 0));
}

function NumericValueDragObject({
  mode,
  node,
  onLiveControl,
  runtimeControlEnabled,
  runtimeControlValue
}: {
  mode: "float" | "int" | "uint";
  node: GraphNodeV01;
  onLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  runtimeControlEnabled: boolean;
  runtimeControlValue?: RuntimeControlValue;
}) {
  const displayValue = numericDisplayValue(mode, node, runtimeControlValue);
  const [draftValue, setDraftValue] = useState(displayValue);

  useEffect(() => {
    setDraftValue(displayValue);
  }, [displayValue]);

  const toControlValue = (value: number): RuntimeControlValue => {
    if (mode === "float") {
      return {
        type: "float",
        representation: readFloatRepresentationParam(node),
        value
      };
    }
    if (mode === "int") {
      return {
        type: "int",
        representation: readIntRepresentationParam(node),
        value: Math.trunc(value)
      };
    }
    return {
      type: "uint",
      representation: readUIntRepresentationParam(node),
      value: Math.max(0, Math.trunc(value))
    };
  };

  const normalize = (value: number): number => {
    if (mode === "float") {
      return value;
    }
    if (mode === "uint") {
      return Math.max(0, Math.trunc(value));
    }
    return Math.trunc(value);
  };

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
            const normalized = normalize(value);
            setDraftValue(normalized);
            onLiveControl?.(node.id, "in", controlMessageFromValue(toControlValue(normalized)));
          },
          precision: mode === "float" ? 4 : 0,
          shiftStep: mode === "float" ? 0.1 : 10,
          startValue: displayValue,
          step: mode === "float" ? 0.01 : 1
        });
      }}
      title={
        runtimeControlEnabled
          ? "Drag horizontally to send a runtime value"
          : "Connect and load a Runtime session to send values"
      }
      type="button"
    >
      {mode === "float" ? formatFloatAtom(draftValue) : formatIntegerAtom(draftValue)}
    </button>
  );
}

function numericDisplayValue(
  mode: "float" | "int" | "uint",
  node: GraphNodeV01,
  runtimeControlValue?: RuntimeControlValue
): number {
  if (mode === "float") {
    return controlFloatValue(runtimeControlValue) ?? readFloatValueParam(node);
  }
  if (mode === "int") {
    return controlIntValue(runtimeControlValue) ?? readIntValueParam(node);
  }
  return controlUIntValue(runtimeControlValue) ?? readUIntValueParam(node);
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
