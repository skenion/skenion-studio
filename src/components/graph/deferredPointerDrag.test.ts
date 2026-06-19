import { describe, expect, it, vi } from "vitest";
import { beginDeferredHorizontalMouseNumberDrag, beginDeferredHorizontalNumberDrag } from "./deferredPointerDrag";

describe("beginDeferredHorizontalNumberDrag", () => {
  it("previews during pointer movement but commits only on pointerup", () => {
    const eventTarget = new EventTarget();
    const target = dragTarget();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    beginDeferredHorizontalNumberDrag({
      event: dragStartEvent(target, 100),
      eventTarget,
      onCommit,
      onPreview,
      startValue: 0.5
    });

    eventTarget.dispatchEvent(pointerMoveEvent(110));
    eventTarget.dispatchEvent(pointerMoveEvent(125, true));

    expect(onPreview).toHaveBeenCalledWith(0.6);
    expect(onPreview).toHaveBeenCalledWith(3);
    expect(onCommit).not.toHaveBeenCalled();

    eventTarget.dispatchEvent(new Event("pointerup"));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(3);
    expect(target.setPointerCapture).toHaveBeenCalledWith(7);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("treats upward movement as an increase", () => {
    const eventTarget = new EventTarget();
    const target = dragTarget();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    beginDeferredHorizontalNumberDrag({
      event: dragStartEvent(target, 100, 100),
      eventTarget,
      onCommit,
      onPreview,
      startValue: 0.5
    });

    eventTarget.dispatchEvent(pointerMoveEvent(100, false, 80));
    eventTarget.dispatchEvent(new Event("pointerup"));

    expect(onPreview).toHaveBeenCalledWith(0.7);
    expect(onCommit).toHaveBeenCalledWith(0.7);
  });

  it("cancels without committing", () => {
    const eventTarget = new EventTarget();
    const target = dragTarget();
    const onCancel = vi.fn();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    beginDeferredHorizontalNumberDrag({
      event: dragStartEvent(target, 100),
      eventTarget,
      onCancel,
      onCommit,
      onPreview,
      startValue: 1
    });

    eventTarget.dispatchEvent(pointerMoveEvent(120));
    eventTarget.dispatchEvent(new Event("pointercancel"));

    expect(onPreview).toHaveBeenCalledWith(1.2);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("supports mouse drag fallback", () => {
    const eventTarget = new EventTarget();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    beginDeferredHorizontalMouseNumberDrag({
      event: mouseStartEvent(50, 100),
      eventTarget,
      onCommit,
      onPreview,
      startValue: 2,
      step: 0.5
    });

    eventTarget.dispatchEvent(mouseMoveEvent(56, false, 100));
    eventTarget.dispatchEvent(new Event("mouseup"));

    expect(onPreview).toHaveBeenCalledWith(5);
    expect(onCommit).toHaveBeenCalledWith(5);
  });
});

function dragTarget() {
  return {
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn()
  };
}

function dragStartEvent(target: ReturnType<typeof dragTarget>, clientX: number, clientY = 0) {
  return {
    clientX,
    clientY,
    currentTarget: target,
    pointerId: 7,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}

function pointerMoveEvent(clientX: number, shiftKey = false, clientY = 0) {
  const event = new Event("pointermove");
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    shiftKey: { value: shiftKey }
  });
  return event;
}

function mouseStartEvent(clientX: number, clientY = 0) {
  return {
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}

function mouseMoveEvent(clientX: number, shiftKey = false, clientY = 0) {
  const event = new Event("mousemove");
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    shiftKey: { value: shiftKey }
  });
  return event;
}
