// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  isEditableShortcutTarget,
  runtimeHistoryShortcutAction,
  type RuntimeHistoryShortcutEvent
} from "./historyShortcuts";

describe("runtime history shortcuts", () => {
  it("maps primary undo and redo shortcuts", () => {
    expect(runtimeHistoryShortcutAction(event({ key: "z", metaKey: true }))).toBe("undo");
    expect(runtimeHistoryShortcutAction(event({ key: "z", ctrlKey: true }))).toBe("undo");
    expect(runtimeHistoryShortcutAction(event({ key: "z", metaKey: true, shiftKey: true }))).toBe("redo");
    expect(runtimeHistoryShortcutAction(event({ key: "y", ctrlKey: true }))).toBe("redo");
  });

  it("does not intercept shortcuts in editable targets", () => {
    const input = document.createElement("input");
    const select = document.createElement("select");
    const textarea = document.createElement("textarea");
    const button = document.createElement("button");
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    expect(isEditableShortcutTarget(input)).toBe(true);
    expect(isEditableShortcutTarget(select)).toBe(true);
    expect(isEditableShortcutTarget(textarea)).toBe(true);
    expect(isEditableShortcutTarget(editable)).toBe(true);
    expect(isEditableShortcutTarget(button)).toBe(false);
    expect(runtimeHistoryShortcutAction(event({ key: "z", metaKey: true, target: input }))).toBeNull();
  });

  it("ignores unrelated modifiers and keys", () => {
    expect(runtimeHistoryShortcutAction(event({ key: "z" }))).toBeNull();
    expect(runtimeHistoryShortcutAction(event({ altKey: true, key: "z", metaKey: true }))).toBeNull();
    expect(runtimeHistoryShortcutAction(event({ key: "y", metaKey: true }))).toBeNull();
    expect(runtimeHistoryShortcutAction(event({ key: "s", metaKey: true }))).toBeNull();
  });
});

function event(overrides: Partial<RuntimeHistoryShortcutEvent>): RuntimeHistoryShortcutEvent {
  return {
    altKey: false,
    ctrlKey: false,
    key: "",
    metaKey: false,
    shiftKey: false,
    target: null,
    ...overrides
  };
}
