export interface DeferredHorizontalNumberDragOptions {
  eventTarget?: NumberDragEventTarget;
  event: {
    clientX: number;
    clientY: number;
    currentTarget: {
      releasePointerCapture?: (pointerId: number) => void;
      setPointerCapture?: (pointerId: number) => void;
    };
    pointerId: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  };
  onCancel?: () => void;
  onCommit: (value: number) => void;
  onPreview: (value: number) => void;
  precision?: number;
  shiftStep?: number;
  startValue: number;
  step?: number;
}

export interface DeferredHorizontalMouseNumberDragOptions {
  eventTarget?: NumberDragEventTarget;
  event: {
    clientX: number;
    clientY: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  };
  onCancel?: () => void;
  onCommit: (value: number) => void;
  onPreview: (value: number) => void;
  precision?: number;
  shiftStep?: number;
  startValue: number;
  step?: number;
}

interface NumberDragEventTarget {
  addEventListener: (
    type: "pointermove" | "pointerup" | "pointercancel" | "mousemove" | "mouseup",
    listener: EventListener,
    options?: AddEventListenerOptions
  ) => void;
  removeEventListener: (
    type: "pointermove" | "pointerup" | "pointercancel" | "mousemove" | "mouseup",
    listener: EventListener
  ) => void;
}

interface NumberDragMoveEvent extends Event {
  clientX: number;
  clientY: number;
  shiftKey?: boolean;
}

export function beginDeferredHorizontalNumberDrag({
  event,
  eventTarget,
  onCancel,
  onCommit,
  onPreview,
  precision = 4,
  shiftStep = 0.1,
  startValue,
  step = 0.01
}: DeferredHorizontalNumberDragOptions) {
  beginNumberDrag({
    cancelEvent: "pointercancel",
    event,
    eventTarget,
    finishEvent: "pointerup",
    moveEvent: "pointermove",
    onCancel,
    onCommit,
    onPreview,
    precision,
    shiftStep,
    startValue,
    step
  });
}

export function beginDeferredHorizontalMouseNumberDrag({
  event,
  eventTarget,
  onCancel,
  onCommit,
  onPreview,
  precision = 4,
  shiftStep = 0.1,
  startValue,
  step = 0.01
}: DeferredHorizontalMouseNumberDragOptions) {
  beginNumberDrag({
    event,
    eventTarget,
    finishEvent: "mouseup",
    moveEvent: "mousemove",
    onCancel,
    onCommit,
    onPreview,
    precision,
    shiftStep,
    startValue,
    step
  });
}

function beginNumberDrag({
  cancelEvent,
  event,
  eventTarget,
  finishEvent,
  moveEvent,
  onCancel,
  onCommit,
  onPreview,
  precision,
  shiftStep,
  startValue,
  step
}: {
  cancelEvent?: "pointercancel";
  event: {
    clientX: number;
    clientY: number;
    currentTarget?: {
      releasePointerCapture?: (pointerId: number) => void;
      setPointerCapture?: (pointerId: number) => void;
    };
    pointerId?: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  };
  eventTarget?: NumberDragEventTarget;
  finishEvent: "pointerup" | "mouseup";
  moveEvent: "pointermove" | "mousemove";
  onCancel?: () => void;
  onCommit: (value: number) => void;
  onPreview: (value: number) => void;
  precision: number;
  shiftStep: number;
  startValue: number;
  step: number;
}) {
  event.preventDefault();
  event.stopPropagation();

  const startX = event.clientX;
  const startY = event.clientY;
  const pointerId = event.pointerId;
  const target = event.currentTarget;
  const listenerTarget = eventTarget ?? window;
  let latestValue = startValue;

  if (typeof pointerId === "number") {
    target?.setPointerCapture?.(pointerId);
  }

  const cleanup = () => {
    listenerTarget.removeEventListener(moveEvent, onMove);
    listenerTarget.removeEventListener(finishEvent, onFinish);
    if (cancelEvent) {
      listenerTarget.removeEventListener(cancelEvent, onCancelDrag);
    }
    if (typeof pointerId === "number") {
      target?.releasePointerCapture?.(pointerId);
    }
  };

  const onMove: EventListener = (event) => {
    const dragEvent = event as NumberDragMoveEvent;
    const delta = (dragEvent.clientX - startX) + (startY - dragEvent.clientY);
    const activeStep = dragEvent.shiftKey ? shiftStep : step;
    latestValue = Number((startValue + delta * activeStep).toFixed(precision));
    onPreview(latestValue);
  };

  const onFinish = () => {
    cleanup();
    if (!Object.is(latestValue, startValue)) {
      onCommit(latestValue);
    }
  };

  const onCancelDrag = () => {
    cleanup();
    onCancel?.();
  };

  listenerTarget.addEventListener(moveEvent, onMove);
  listenerTarget.addEventListener(finishEvent, onFinish, { once: true });
  if (cancelEvent) {
    listenerTarget.addEventListener(cancelEvent, onCancelDrag, { once: true });
  }
}
