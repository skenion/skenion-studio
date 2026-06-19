import { describe, expect, it } from "vitest";
import {
  bangControlMessage,
  controlMessageFromValue,
  firstControlAtom,
  setControlMessage
} from "./controlMessage";

describe("runtime control messages", () => {
  it("represents bang as a selector without atoms", () => {
    expect(bangControlMessage()).toEqual({ selector: "bang", atoms: [] });
    expect(firstControlAtom(bangControlMessage())).toBeNull();
  });

  it("wraps typed values as selector and atom messages", () => {
    expect(controlMessageFromValue({ type: "float", representation: "f32", value: 1.25 })).toEqual({
      selector: "float",
      atoms: [{ type: "float", representation: "f32", value: 1.25 }]
    });
    expect(controlMessageFromValue({ type: "int", representation: "i32", value: 7 })).toEqual({
      selector: "int",
      atoms: [{ type: "int", representation: "i32", value: 7 }]
    });
    expect(controlMessageFromValue({ type: "uint", representation: "u32", value: 7 })).toEqual({
      selector: "uint",
      atoms: [{ type: "uint", representation: "u32", value: 7 }]
    });
    expect(controlMessageFromValue({ type: "bool", value: true })).toEqual({
      selector: "bool",
      atoms: [{ type: "bool", value: true }]
    });
    expect(controlMessageFromValue({ type: "string", value: "ready" })).toEqual({
      selector: "symbol",
      atoms: [{ type: "string", value: "ready" }]
    });
    expect(controlMessageFromValue({ type: "color", representation: "rgba32f", colorSpace: "linear", value: [1, 0.5, 0, 1] })).toEqual({
      selector: "color",
      atoms: [{ type: "color", representation: "rgba32f", colorSpace: "linear", value: [1, 0.5, 0, 1] }]
    });
  });

  it("wraps silent set messages and exposes first atom", () => {
    const message = setControlMessage({ type: "string", value: "queued" });

    expect(message).toEqual({
      selector: "set",
      atoms: [{ type: "string", value: "queued" }]
    });
    expect(firstControlAtom(message)).toEqual({ type: "string", value: "queued" });
  });
});
