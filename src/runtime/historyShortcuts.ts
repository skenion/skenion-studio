export type RuntimeHistoryShortcutAction = "undo" | "redo";

export interface RuntimeHistoryShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

export function runtimeHistoryShortcutAction(
  event: RuntimeHistoryShortcutEvent
): RuntimeHistoryShortcutAction | null {
  if (isEditableShortcutTarget(event.target) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  const primaryModifier = event.metaKey || event.ctrlKey;
  if (!primaryModifier) {
    return null;
  }

  if (key === "z" && event.shiftKey) {
    return "redo";
  }
  if (key === "z") {
    return "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return "redo";
  }

  return null;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "select" || tagName === "textarea";
}
