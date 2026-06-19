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
  UI_BUTTON_NODE_KIND,
  UI_SLIDER_FLOAT_NODE_KIND,
  UI_TOGGLE_NODE_KIND,
  readPanelLabelParam,
  readUiSliderParams,
  readUiToggleValue
} from "../../graph/panelControls";
import { TOGGLE_NODE_KIND, readToggleParam } from "../../graph/toggleValue";
import { VIDEO_ASSET_NODE_KIND, readVideoAssetParams } from "../../graph/videoAsset";
import { PANEL_NODE_KIND, readPanelParams } from "../../graph/panelNode";
import type { NodeCardView, NodePortHandleRenderer, NodePortView } from "../node/nodeTypes";
import type { RuntimeControlMessage } from "../../runtime/types";
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
  selected?: boolean;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
}

export function ObjectNodeRenderer({
  card,
  node,
  onObjectControl,
  onObjectLiveControl,
  onObjectParamChange,
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
        inputPorts={card.inputs}
        onActivate={(event) => {
          event.stopPropagation();
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

  if (node.kind === UI_BUTTON_NODE_KIND) {
    return (
      <ObjectBox
        className={styles.bangObject}
        inputPorts={card.inputs}
        onActivate={(event) => {
          event.stopPropagation();
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

  if (node.kind === UI_TOGGLE_NODE_KIND || node.kind === TOGGLE_NODE_KIND) {
    const value = node.kind === UI_TOGGLE_NODE_KIND ? readUiToggleValue(node) : readToggleParam(node);
    return (
      <ObjectBox
        className={styles.toggleObject}
        inputPorts={card.inputs}
        onActivate={(event) => {
          event.stopPropagation();
          onObjectControl?.(node.id, "bang", bangControlMessage());
        }}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        role="button"
        selected={selected}
      >
        <span className={[styles.toggleSwitch, value ? styles.toggleOn : ""].filter(Boolean).join(" ")} />
        <span>{node.kind === UI_TOGGLE_NODE_KIND ? readPanelLabelParam(node) : String(node.params.label ?? node.id)}</span>
      </ObjectBox>
    );
  }

  if (node.kind === UI_SLIDER_FLOAT_NODE_KIND) {
    return (
      <SliderControlObject
        card={card}
        node={node}
        onLiveControl={onObjectLiveControl ?? onObjectControl}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      />
    );
  }

  if (isValueObject(node)) {
    return (
      <ObjectBox
        className={styles.valueObject}
        inputPorts={card.inputs}
        outputPorts={card.outputs}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      >
        <span className={styles.valueKind}>{valueKindLabel(node)}</span>
        {node.kind === FLOAT_VALUE_NODE_KIND ? (
          <FloatValueDragObject
            node={node}
            onCommit={onObjectParamChange}
            onLiveControl={onObjectLiveControl ?? onObjectControl}
          />
        ) : (
          <span className={styles.valueText}>{valueLabel(node)}</span>
        )}
        <span className={styles.representationBadge}>{representationLabel(node)}</span>
        <RoutingBadges node={node} />
      </ObjectBox>
    );
  }

  if (node.kind === VIDEO_ASSET_NODE_KIND) {
    const asset = readVideoAssetParams(node);
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
      <span className={styles.genericKind}>{node.kind}</span>
    </ObjectBox>
  );
}

function SliderControlObject({
  card,
  node,
  onLiveControl,
  renderInputHandle,
  renderOutputHandle,
  selected
}: {
  card: NodeCardView;
  node: GraphNodeV01;
  onLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  selected?: boolean;
}) {
  const slider = readUiSliderParams(node);
  const [value, setValue] = useState(slider.value);

  useEffect(() => {
    setValue(slider.value);
  }, [slider.value]);

  const range = slider.max - slider.min;
  const percent = range === 0 ? 0 : Math.min(100, Math.max(0, ((value - slider.min) / range) * 100));

  return (
    <ObjectBox
      className={styles.sliderObject}
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
        max={slider.max}
        min={slider.min}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (!Number.isFinite(nextValue)) {
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
      className={[styles.objectNode, className, selected ? styles.selected : ""].filter(Boolean).join(" ")}
      onClick={onActivate}
      role={role}
      style={style}
      tabIndex={role === "button" ? 0 : undefined}
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

function valueLabel(node: GraphNodeV01): string {
  if (node.kind === FLOAT_VALUE_NODE_KIND) return formatValue(readFloatValueParam(node));
  if (node.kind === INT_VALUE_NODE_KIND) return String(readIntValueParam(node));
  if (node.kind === UINT_VALUE_NODE_KIND) return String(readUIntValueParam(node));
  if (node.kind === BOOL_VALUE_NODE_KIND) return readBoolValueParam(node) ? "true" : "false";
  if (node.kind === COLOR_NODE_KIND) return readColorRgbaParam(node).map(formatValue).join(" ");
  return readStringValueParam(node) || "\"\"";
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
  onCommit
}: {
  node: GraphNodeV01;
  onLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onCommit?: (nodeId: string, key: string, value: unknown) => void;
}) {
  const graphValue = readFloatValueParam(node);
  const [draftValue, setDraftValue] = useState(graphValue);

  useEffect(() => {
    setDraftValue(graphValue);
  }, [graphValue]);

  return (
    <button
      className={[styles.valueDrag, "nodrag", "nopan"].join(" ")}
      onPointerDown={(event) =>
        beginDeferredHorizontalNumberDrag({
          event,
          onCancel: () => setDraftValue(graphValue),
          onCommit: (value) => onCommit?.(node.id, "value", value),
          onPreview: (value) => {
            setDraftValue(value);
            onLiveControl?.(
              node.id,
              "in",
              controlMessageFromValue({ type: "float", representation: "f32", value })
            );
          },
          startValue: graphValue
        })
      }
      title="Drag horizontally to change value"
      type="button"
    >
      {formatValue(draftValue)}
    </button>
  );
}
