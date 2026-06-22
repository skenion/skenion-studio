import type { DisplayGraphNodeV01 } from "../../graph/patchLibrary";
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
  readBangParams,
  isSliderFloatNode,
  isToggleControlNode,
  readPanelLabelParam,
  readSliderFloatParams,
  readToggleControlValue
} from "../../graph/panelControls";
import {
  DEFAULT_VIDEO_ASSET_HEIGHT,
  DEFAULT_VIDEO_ASSET_WIDTH,
  MAX_VIDEO_ASSET_HEIGHT,
  MAX_VIDEO_ASSET_WIDTH,
  MIN_VIDEO_ASSET_HEIGHT,
  MIN_VIDEO_ASSET_WIDTH,
  VIDEO_ASSET_NODE_KIND,
  type VideoAssetParams,
  readVideoAssetParams
} from "../../graph/videoAsset";
import { PANEL_NODE_KIND, readPanelParams } from "../../graph/panelNode";
import { genericObjectTextForNode } from "../../graph/objectTextDisplay";
import { isUnresolvedObjectNode } from "../../graph/objectTextNode";
import type { NodeCardView, NodePortHandleRenderer, NodePortView } from "../node/nodeTypes";
import type { RuntimeControlMessage, RuntimeControlValue } from "../../runtime/types";
import { bangControlMessage, controlMessageFromValue } from "../../runtime/controlMessage";
import { objectViewSpecForNode, type ObjectChromePolicy } from "../../graph/objectViewSpec";
import { beginDeferredHorizontalMouseNumberDrag, beginDeferredHorizontalNumberDrag } from "./deferredPointerDrag";
import styles from "./ObjectNodeRenderer.module.css";
import socketStyles from "../node/PortSocket.module.css";

export interface ObjectNodeRendererProps {
  card: NodeCardView;
  layoutEditable?: boolean;
  node: DisplayGraphNodeV01;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void> | void;
  onObjectLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onObjectTextCommit?: (nodeId: string, text: string) => void;
  runtimeControlEnabled?: boolean;
  runtimeControlPulseKey?: number;
  runtimeControlValue?: RuntimeControlValue;
  selected?: boolean;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
}

export function ObjectNodeRenderer({
  card,
  layoutEditable = false,
  node,
  onImportAsset,
  onObjectControl,
  onObjectLiveControl,
  onObjectParamChange,
  onObjectTextCommit,
  runtimeControlEnabled = false,
  runtimeControlPulseKey = 0,
  runtimeControlValue,
  selected,
  renderInputHandle,
  renderOutputHandle
}: ObjectNodeRendererProps) {
  const viewSpec = objectViewSpecForNode(node);
  if (node.kind === "core.comment") {
    return (
      <ObjectBox
        className={styles.commentObject}
        chromePolicy={viewSpec.chromePolicy}
        inputPorts={card.inputs}
        layoutEditable={layoutEditable}
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
        chromePolicy={viewSpec.chromePolicy}
        inputPorts={card.inputs}
        layoutEditable={layoutEditable}
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
        chromePolicy={viewSpec.chromePolicy}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        layoutEditable={layoutEditable}
        onActivate={() => {
          if (!runtimeControlEnabled) {
            return;
          }
          onObjectControl?.(node.id, "in", bangControlMessage());
        }}
        preserveActivationClickPropagation
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
        chromePolicy={viewSpec.chromePolicy}
        layoutEditable={layoutEditable}
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

  const toggleNode = node as DisplayGraphNodeV01;
  if (isToggleControlNode(toggleNode)) {
    const value = controlBoolValue(runtimeControlValue) ?? readToggleControlValue(toggleNode);
    const nodeId = toggleNode.id;
    return (
      <ObjectBox
        className={styles.toggleObject}
        chromePolicy={viewSpec.chromePolicy}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        layoutEditable={layoutEditable}
        onActivate={() => {
          if (!runtimeControlEnabled) {
            return;
          }
          onObjectControl?.(nodeId, "in", bangControlMessage());
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

  const sliderNode = node as DisplayGraphNodeV01;
  if (isSliderFloatNode(sliderNode)) {
    return (
      <SliderControlObject
        card={card}
        chromePolicy={viewSpec.chromePolicy}
        layoutEditable={layoutEditable}
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

  const valueNode = node as DisplayGraphNodeV01;
  if (isValueObject(valueNode)) {
    return (
      <ObjectBox
        className={styles.valueObject}
        chromePolicy={viewSpec.chromePolicy}
        disabled={!runtimeControlEnabled}
        inputPorts={card.inputs}
        layoutEditable={layoutEditable}
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

  const fallbackNode = node as DisplayGraphNodeV01;
  if (fallbackNode.kind === VIDEO_ASSET_NODE_KIND) {
    return (
      <VideoAssetObject
        card={card}
        chromePolicy={viewSpec.chromePolicy}
        layoutEditable={layoutEditable}
        node={fallbackNode}
        onImportAsset={onImportAsset}
        onObjectParamChange={onObjectParamChange}
        renderInputHandle={renderInputHandle}
        renderOutputHandle={renderOutputHandle}
        selected={selected}
      />
    );
  }

  return (
    <GenericObjectBox
      card={card}
      chromePolicy={viewSpec.chromePolicy}
      layoutEditable={layoutEditable}
      node={fallbackNode}
      onObjectTextCommit={onObjectTextCommit}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      selected={selected}
    />
  );
}

function GenericObjectBox({
  card,
  chromePolicy,
  layoutEditable,
  node,
  onObjectTextCommit,
  renderInputHandle,
  renderOutputHandle,
  selected
}: {
  card: NodeCardView;
  chromePolicy: ObjectChromePolicy;
  layoutEditable: boolean;
  node: DisplayGraphNodeV01;
  onObjectTextCommit?: (nodeId: string, text: string) => void;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  selected?: boolean;
}) {
  const displayText = genericObjectTextForNode(node);
  const unresolved = isUnresolvedObjectNode(node);
  const diagnosticMessage = typeof node.params.diagnosticMessage === "string" ? node.params.diagnosticMessage : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayText);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const finishedEditRef = useRef(false);
  const editable = layoutEditable && Boolean(onObjectTextCommit);

  useEffect(() => {
    if (!editing) {
      setDraft(displayText);
    }
  }, [displayText, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const beginEdit = () => {
    if (!editable) {
      return;
    }
    finishedEditRef.current = false;
    setDraft(displayText);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (finishedEditRef.current) {
      return;
    }
    finishedEditRef.current = true;
    setDraft(displayText);
    setEditing(false);
  };

  const commitEdit = (value = draft) => {
    if (finishedEditRef.current) {
      return;
    }
    finishedEditRef.current = true;
    const nextText = value.trim();
    setEditing(false);
    if (nextText.length === 0 || nextText === displayText) {
      return;
    }
    onObjectTextCommit?.(node.id, nextText);
  };

  return (
    <ObjectBox
      className={[styles.genericObject, unresolved ? styles.unresolvedObject : ""].filter(Boolean).join(" ")}
      chromePolicy={chromePolicy}
      inputPorts={card.inputs}
      layoutEditable={layoutEditable}
      onDoubleClick={editable ? beginEdit : undefined}
      outputPorts={card.outputs}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      selected={selected}
      title={diagnosticMessage}
    >
      {editing ? (
        <input
          ref={inputRef}
          aria-label="Object text"
          className={[styles.objectTextInput, "nodrag", "nopan"].join(" ")}
          onBlur={(event) => commitEdit(event.currentTarget.value)}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              commitEdit(event.currentTarget.value);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cancelEdit();
            }
          }}
          onPointerDown={(event) => event.stopPropagation()}
          value={draft}
        />
      ) : (
        <span className={styles.genericText}>{displayText}</span>
      )}
    </ObjectBox>
  );
}

function VideoAssetObject({
  card,
  chromePolicy,
  layoutEditable,
  node,
  onImportAsset,
  onObjectParamChange,
  renderInputHandle,
  renderOutputHandle,
  selected
}: {
  card: NodeCardView;
  chromePolicy: ObjectChromePolicy;
  layoutEditable: boolean;
  node: DisplayGraphNodeV01;
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void> | void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  selected?: boolean;
}) {
  const asset = readVideoAssetParams(node);
  const assetSize = displaySizeForAsset(asset);
  const [draftSize, setDraftSize] = useState(assetSize);
  const draftSizeRef = useRef(draftSize);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canResize = layoutEditable && Boolean(onObjectParamChange);
  const resizeAspectRatio = loadedAssetHasMedia(asset)
    ? asset.aspectRatio
    : DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT;

  useEffect(() => {
    setDraftSize(assetSize);
    draftSizeRef.current = assetSize;
  }, [assetSize.height, assetSize.width]);

  const commitSize = (size: { width: number; height: number }) => {
    if (size.width === asset.width && size.height === asset.height) {
      return;
    }
    onObjectParamChange?.(node.id, "width", size.width);
    onObjectParamChange?.(node.id, "height", size.height);
  };

  const handleResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!canResize || !isPrimaryPointerButton(event.button)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget;
    const start = {
      height: draftSizeRef.current.height,
      pointerId: event.pointerId,
      width: draftSizeRef.current.width,
      x: event.clientX,
      y: event.clientY
    };
    const aspectRatio = resizeAspectRatio > 0 ? resizeAspectRatio : start.width / start.height;
    handle.setPointerCapture(event.pointerId);

    const updateSize = (moveEvent: globalThis.PointerEvent) => {
      const nextSize = resizeAssetBox(start, moveEvent.clientX - start.x, moveEvent.clientY - start.y, aspectRatio);
      draftSizeRef.current = nextSize;
      setDraftSize(nextSize);
    };
    const endResize = (endEvent: globalThis.PointerEvent) => {
      if (endEvent.pointerId !== start.pointerId) {
        return;
      }
      window.removeEventListener("pointermove", updateSize);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", endResize);
      if (handle.hasPointerCapture(start.pointerId)) {
        handle.releasePointerCapture(start.pointerId);
      }
      commitSize(draftSizeRef.current);
    };

    window.addEventListener("pointermove", updateSize);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  };

  return (
    <ObjectBox
      className={styles.assetObject}
      chromePolicy={chromePolicy}
      inputPorts={card.inputs}
      layoutEditable={layoutEditable}
      outputPorts={card.outputs}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      selected={selected}
      onDoubleClick={() => {
        if (onImportAsset) {
          fileInputRef.current?.click();
        }
      }}
      style={{
        height: draftSize.height,
        width: draftSize.width
      }}
    >
      <input
        ref={fileInputRef}
        accept="video/*"
        className={styles.assetFileInput}
        disabled={!onImportAsset}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) {
            void onImportAsset?.(node, file);
          }
        }}
        type="file"
      />
      <div className={styles.assetFrame}>
        {asset.thumbnailDataUrl ? (
          <img alt="" className={styles.assetThumbnail} draggable={false} src={asset.thumbnailDataUrl} />
        ) : (
          <div className={styles.assetPlaceholder} />
        )}
        {asset.name ? <span className={styles.assetCaption}>{asset.name}</span> : null}
      </div>
      {canResize ? (
        <button
          aria-label="Resize asset"
          className={[styles.assetResizeHandle, "nodrag", "nopan"].join(" ")}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDown={handleResizePointerDown}
          type="button"
        />
      ) : null}
    </ObjectBox>
  );
}

function SliderControlObject({
  card,
  chromePolicy,
  layoutEditable,
  node,
  onLiveControl,
  runtimeControlEnabled,
  runtimeControlValue,
  renderInputHandle,
  renderOutputHandle,
  selected
}: {
  card: NodeCardView;
  chromePolicy: ObjectChromePolicy;
  layoutEditable: boolean;
  node: DisplayGraphNodeV01;
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
      chromePolicy={chromePolicy}
      disabled={!runtimeControlEnabled}
      inputPorts={card.inputs}
      layoutEditable={layoutEditable}
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
  chromePolicy,
  layoutEditable,
  node,
  onObjectControl,
  pulseKey,
  renderInputHandle,
  renderOutputHandle,
  runtimeControlEnabled,
  selected
}: {
  card: NodeCardView;
  chromePolicy: ObjectChromePolicy;
  layoutEditable: boolean;
  node: DisplayGraphNodeV01;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  pulseKey: number;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  runtimeControlEnabled: boolean;
  selected?: boolean;
}) {
  const bangParams = readBangParams(node);
  const [active, setActive] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const pulse = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    setActive(true);
    resetTimerRef.current = window.setTimeout(() => {
      setActive(false);
      resetTimerRef.current = null;
    }, 140);
  };

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (pulseKey > 0) {
      pulse();
    }
  }, [pulseKey]);

  const activate = () => {
    if (!runtimeControlEnabled) {
      return;
    }
    pulse();
    onObjectControl?.(node.id, "in", bangControlMessage());
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!runtimeControlEnabled || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!runtimeControlEnabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance <= 4) {
      activate();
    }
  };

  return (
    <ObjectBox
      className={styles.bangObject}
      chromePolicy={chromePolicy}
      disabled={!runtimeControlEnabled}
      inputPorts={card.inputs}
      layoutEditable={layoutEditable}
      outputPorts={card.outputs}
      renderInputHandle={renderInputHandle}
      renderOutputHandle={renderOutputHandle}
      selected={selected}
    >
      <button
        aria-label={bangParams.label}
        className={[styles.bangTrigger, "nodrag", "nopan"].join(" ")}
        disabled={!runtimeControlEnabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          activate();
        }}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        type="button"
      >
        <span
          className={[styles.bangDot, active ? styles.bangActive : ""].filter(Boolean).join(" ")}
          style={{ borderRadius: bangParams.radius }}
        />
      </button>
    </ObjectBox>
  );
}

function ObjectBox({
  children,
  chromePolicy,
  className,
  disabled = false,
  inputPorts = [],
  layoutEditable,
  onActivate,
  onDoubleClick,
  outputPorts = [],
  preserveActivationClickPropagation = false,
  renderInputHandle,
  renderOutputHandle,
  role,
  selected,
  style,
  title
}: {
  children: ReactNode;
  chromePolicy: ObjectChromePolicy;
  className: string;
  disabled?: boolean;
  inputPorts?: NodePortView[];
  layoutEditable: boolean;
  onActivate?: () => void;
  onDoubleClick?: () => void;
  outputPorts?: NodePortView[];
  preserveActivationClickPropagation?: boolean;
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
  role?: "button";
  selected?: boolean;
  style?: CSSProperties;
  title?: string;
}) {
  const objectStyle = {
    ...style,
    "--object-port-min-width": `${minimumWidthForPorts(inputPorts.length, outputPorts.length)}px`
  } as CSSProperties;

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onActivate || disabled) {
      return;
    }
    if (!preserveActivationClickPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }
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

  const handleDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!onDoubleClick || disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDoubleClick();
  };

  return (
    <div
      aria-disabled={disabled || undefined}
      className={[
        styles.objectNode,
        chromePolicyClassName(chromePolicy),
        className,
        layoutEditable ? styles.layoutEditable : "",
        onActivate ? "nopan" : "",
        selected ? styles.selected : "",
        disabled ? styles.disabled : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role={role}
      style={objectStyle}
      tabIndex={role === "button" && !disabled ? 0 : undefined}
      title={title}
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

function chromePolicyClassName(policy: ObjectChromePolicy): string {
  switch (policy) {
    case "none":
      return styles.chromeNone;
    case "widget":
      return styles.chromeWidget;
    case "container":
      return styles.chromeContainer;
    case "box":
      return styles.chromeBox;
  }
}

function minimumWidthForPorts(inputCount: number, outputCount: number): number {
  const portCount = Math.max(inputCount, outputCount);
  if (portCount <= 1) {
    return 32;
  }
  const socketWidth = 12;
  const socketGap = 4;
  const sidePadding = 10;
  return portCount * socketWidth + (portCount - 1) * socketGap + sidePadding;
}

function RoutingBadges({ node }: { node: DisplayGraphNodeV01 }) {
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

function isValueObject(node: DisplayGraphNodeV01): boolean {
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
  node: DisplayGraphNodeV01;
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
  node: DisplayGraphNodeV01;
  onLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  runtimeControlEnabled: boolean;
  runtimeControlValue?: RuntimeControlValue;
}) {
  const displayValue = numericDisplayValue(mode, node, runtimeControlValue);
  const [draftValue, setDraftValue] = useState(displayValue);
  const suppressMouseDragRef = useRef(false);
  const formattedDraftValue = mode === "float" ? formatFloatAtom(draftValue) : formatIntegerAtom(draftValue);
  const formattedDisplayValue = mode === "float" ? formatFloatAtom(displayValue) : formatIntegerAtom(displayValue);
  const stableWidthCh = Math.max(3, formattedDraftValue.length, formattedDisplayValue.length) + 1;

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

  const previewValue = (value: number) => {
    const normalized = normalize(value);
    setDraftValue(normalized);
    onLiveControl?.(node.id, "in", controlMessageFromValue(toControlValue(normalized)));
  };

  return (
    <button
      className={[styles.valueDrag, "nodrag", "nopan"].join(" ")}
      disabled={!runtimeControlEnabled}
      onMouseDown={(event) => {
        if (!runtimeControlEnabled || !isPrimaryPointerButton(event.button)) {
          return;
        }
        if (suppressMouseDragRef.current) {
          return;
        }
        beginDeferredHorizontalMouseNumberDrag({
          event,
          onCancel: () => setDraftValue(displayValue),
          onCommit: () => undefined,
          onPreview: previewValue,
          precision: mode === "float" ? 4 : 0,
          shiftStep: mode === "float" ? 0.1 : 10,
          startValue: displayValue,
          step: mode === "float" ? 0.01 : 1
        });
      }}
      onPointerDown={(event) => {
        if (!runtimeControlEnabled || !isPrimaryPointerButton(event.button)) {
          return;
        }
        suppressMouseDragRef.current = true;
        window.setTimeout(() => {
          suppressMouseDragRef.current = false;
        }, 0);
        beginDeferredHorizontalNumberDrag({
          event,
          onCancel: () => setDraftValue(displayValue),
          onCommit: () => undefined,
          onPreview: previewValue,
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
      style={{ "--atom-width": `${stableWidthCh}ch` } as CSSProperties}
    >
      {formattedDraftValue}
    </button>
  );
}

function numericDisplayValue(
  mode: "float" | "int" | "uint",
  node: DisplayGraphNodeV01,
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

function resizeAssetBox(
  start: { height: number; width: number },
  deltaX: number,
  deltaY: number,
  aspectRatio: number
): { width: number; height: number } {
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : start.width / start.height;
  const rawWidth =
    Math.abs(deltaX) >= Math.abs(deltaY)
      ? start.width + deltaX
      : (start.height + deltaY) * safeAspectRatio;
  const widthByBounds = clampNumber(rawWidth, MIN_VIDEO_ASSET_WIDTH, MAX_VIDEO_ASSET_WIDTH);
  let nextWidth = widthByBounds;
  let nextHeight = Math.round(nextWidth / safeAspectRatio);

  if (nextHeight < MIN_VIDEO_ASSET_HEIGHT) {
    nextHeight = MIN_VIDEO_ASSET_HEIGHT;
    nextWidth = Math.round(nextHeight * safeAspectRatio);
  }
  if (nextHeight > MAX_VIDEO_ASSET_HEIGHT) {
    nextHeight = MAX_VIDEO_ASSET_HEIGHT;
    nextWidth = Math.round(nextHeight * safeAspectRatio);
  }

  return {
    height: clampNumber(nextHeight, MIN_VIDEO_ASSET_HEIGHT, MAX_VIDEO_ASSET_HEIGHT),
    width: clampNumber(nextWidth, MIN_VIDEO_ASSET_WIDTH, MAX_VIDEO_ASSET_WIDTH)
  };
}

function displaySizeForAsset(asset: VideoAssetParams): { width: number; height: number } {
  if (loadedAssetHasMedia(asset)) {
    return {
      height: asset.height,
      width: asset.width
    };
  }

  const width = clampNumber(asset.width, MIN_VIDEO_ASSET_WIDTH, MAX_VIDEO_ASSET_WIDTH);
  return {
    height: Math.round(width / (DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT)),
    width
  };
}

function loadedAssetHasMedia(asset: VideoAssetParams): boolean {
  return Boolean(asset.assetRef || asset.thumbnailDataUrl);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function isPrimaryPointerButton(button: number): boolean {
  return button === 0;
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
