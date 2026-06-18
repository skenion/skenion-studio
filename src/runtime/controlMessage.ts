import type { RuntimeControlMessage, RuntimeControlValue } from "./types";

export const bangControlMessage = (): RuntimeControlMessage => ({
  selector: "bang",
  atoms: []
});

export function controlMessageFromValue(value: RuntimeControlValue): RuntimeControlMessage {
  return {
    selector: selectorForControlValue(value),
    atoms: [value]
  };
}

export function setControlMessage(value: RuntimeControlValue): RuntimeControlMessage {
  return {
    selector: "set",
    atoms: [value]
  };
}

export function firstControlAtom(message: RuntimeControlMessage): RuntimeControlValue | null {
  return message.atoms[0] ?? null;
}

function selectorForControlValue(value: RuntimeControlValue): string {
  if (value.type === "f32") {
    return "float";
  }
  if (value.type === "i32") {
    return "int";
  }
  if (value.type === "bool") {
    return "bool";
  }
  if (value.type === "rgba") {
    return "rgba";
  }
  return "symbol";
}
