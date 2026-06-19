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
  if (value.type === "float") {
    return "float";
  }
  if (value.type === "int") {
    return "int";
  }
  if (value.type === "uint") {
    return "uint";
  }
  if (value.type === "bool") {
    return "bool";
  }
  if (value.type === "color") {
    return "color";
  }
  return "symbol";
}
