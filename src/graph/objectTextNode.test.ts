import { describe, expect, it } from "vitest";
import type { ObjectTextPortV01, PortV01 } from "@skenion/contracts";
import { nodeRegistry } from "../data/registry";
import {
  createGraphNodeFromObjectText,
  objectTextRegistryDiagnostic,
  objectTextPortToGraphPort,
  objectTextTypeToGraphType
} from "./objectTextNode";

describe("object text graph node adapter", () => {
  it("creates a canonical control operator node from object text", () => {
    const result = createGraphNodeFromObjectText("+ 1.", []);

    expect(result.ok).toBe(true);
    expect(result.node).toMatchObject({
      id: "add_1",
      kind: "core.operator.add",
      kindVersion: "0.1.0",
      params: {
        right: 1,
        label: "+ 1.",
        objectText: "+ 1."
      }
    });
    expect(result.node?.ports).toEqual([
      {
        id: "in",
        direction: "input",
        label: "In",
        type: { flow: "event", dataKind: "message.any" },
        required: false,
        activation: "trigger"
      },
      {
        id: "right",
        direction: "input",
        label: "Right",
        type: { flow: "value", dataKind: "number.float", format: "f32" },
        required: false,
        activation: "latched",
        default: 1
      },
      {
        id: "out",
        direction: "output",
        label: "Out",
        type: { flow: "value", dataKind: "number.float", format: "f32" },
        required: false
      }
    ]);
  });

  it("creates audio signal nodes without losing scalar defaults", () => {
    const result = createGraphNodeFromObjectText("*~ 0.5", []);

    expect(result.ok).toBe(true);
    expect(result.node).toMatchObject({
      id: "mul_1",
      kind: "audio.operator.mul",
      params: {
        right: 0.5,
        label: "*~ 0.5",
        objectText: "*~ 0.5"
      }
    });
    expect(result.node?.ports.map((port) => [port.id, port.type, port.default ?? null])).toEqual([
      ["in", { flow: "signal", dataKind: "signal.audio" }, null],
      ["right", { flow: "value", dataKind: "number.float", format: "f32" }, 0.5],
      ["out", { flow: "signal", dataKind: "signal.audio" }, null]
    ]);
  });

  it("blocks object text interfaces that the current registry cannot accept", () => {
    const result = createGraphNodeFromObjectText("*~ 0.5", [], nodeRegistry);

    expect(result.ok).toBe(false);
    expect(result.node).toBeNull();
    expect(result.diagnostics.at(-1)).toMatchObject({
      severity: "error",
      code: "unsupported-object-interface"
    });
  });

  it("allows registry-compatible object text interfaces", () => {
    const add = createGraphNodeFromObjectText("+ 1", [], nodeRegistry);
    const oscillator = createGraphNodeFromObjectText("osc~ 440", [], nodeRegistry);

    expect(add.ok).toBe(true);
    expect(add.node?.kind).toBe("core.operator.add");
    expect(oscillator.ok).toBe(true);
    expect(oscillator.node?.kind).toBe("audio.osc");
  });

  it("does not create graph nodes for invalid or deferred object text", () => {
    const invalid = createGraphNodeFromObjectText("sin~", []);
    const empty = createGraphNodeFromObjectText("", []);

    expect(invalid.ok).toBe(false);
    expect(invalid.node).toBeNull();
    expect(invalid.diagnostics[0]?.code).toBe("deferred-object");
    expect(empty.ok).toBe(false);
    expect(empty.node).toBeNull();
  });

  it("creates unique ids when object text adds repeated operator nodes", () => {
    const first = createGraphNodeFromObjectText("+ 1", []);
    const second = createGraphNodeFromObjectText("+ 2", [first.node!]);
    const third = createGraphNodeFromObjectText("+ 3", [first.node!, { ...second.node!, id: "add_3" }]);

    expect(first.node?.id).toBe("add_1");
    expect(second.node?.id).toBe("add_2");
    expect(third.node?.id).toBe("add_4");
  });

  it("maps object text type strings to graph data types", () => {
    expect(objectTextTypeToGraphType("message.any")).toEqual({ flow: "event", dataKind: "message.any" });
    expect(objectTextTypeToGraphType("event.bang")).toEqual({ flow: "event", dataKind: "event.bang" });
    expect(objectTextTypeToGraphType("signal.audio")).toEqual({ flow: "signal", dataKind: "signal.audio" });
    expect(objectTextTypeToGraphType("asset.video")).toEqual({ flow: "resource", dataKind: "asset.video" });
    expect(objectTextTypeToGraphType("video.frame")).toEqual({ flow: "stream", dataKind: "video.frame" });
    expect(objectTextTypeToGraphType("number.int")).toEqual({ flow: "value", dataKind: "number.int", format: "i32" });
    expect(objectTextTypeToGraphType("number.uint")).toEqual({ flow: "value", dataKind: "number.uint", format: "u32" });
    expect(objectTextTypeToGraphType("color")).toEqual({ flow: "value", dataKind: "color", format: "rgba32f" });
  });

  it("reports unavailable object kinds when registry lookup fails", () => {
    const parseResult = createGraphNodeFromObjectText("+ 1", []).parseResult;

    expect(objectTextRegistryDiagnostic(parseResult, [])).toBeNull();
    expect(objectTextRegistryDiagnostic({ ...parseResult, ok: false }, nodeRegistry)).toBeNull();
    expect(objectTextRegistryDiagnostic({ ...parseResult, resolvedKind: null }, nodeRegistry)).toBeNull();
    expect(objectTextRegistryDiagnostic({ ...parseResult, resolvedKindVersion: null }, nodeRegistry)).toBeNull();
    expect(objectTextRegistryDiagnostic(parseResult, nodeRegistry.filter((definition) => definition.id !== "core.operator.add"))).toMatchObject({
      code: "unavailable-object-kind"
    });
  });

  it("describes each registry port mismatch class", () => {
    const parseResult = createGraphNodeFromObjectText("+ 1", []).parseResult;
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.operator.add")!;

    expect(objectTextRegistryDiagnostic(parseResult, [{ ...definition, ports: definition.ports.slice(0, 2) }])?.message).toContain(
      "parser produced 3 ports"
    );
    expect(
      objectTextRegistryDiagnostic(parseResult, [
        { ...definition, ports: [{ ...definition.ports[0]!, direction: "output" }, ...definition.ports.slice(1)] }
      ])?.message
    ).toContain("expected output");
    expect(
      objectTextRegistryDiagnostic(parseResult, [
        {
          ...definition,
          ports: [
            definition.ports[0]!,
            { ...definition.ports[1]!, type: { ...definition.ports[1]!.type, dataKind: "number.int" } },
            definition.ports[2]!
          ]
        }
      ])?.message
    ).toContain("expected value<number.int>");
    expect(
      objectTextRegistryDiagnostic(parseResult, [
        {
          ...definition,
          ports: [
            definition.ports[0]!,
            { ...definition.ports[1]!, type: { ...definition.ports[1]!.type, format: "f64" } },
            definition.ports[2]!
          ]
        }
      ])?.message
    ).toContain("expected f64");
    expect(
      objectTextRegistryDiagnostic(parseResult, [
        {
          ...definition,
          ports: [
            definition.ports[0]!,
            { ...definition.ports[1]!, type: { flow: "value", dataKind: "number.float" } },
            definition.ports[2]!
          ]
        }
      ])?.message
    ).toContain("expected none");
    expect(
      objectTextRegistryDiagnostic(parseResult, [
        {
          ...definition,
          ports: [{ ...definition.ports[0]!, activation: "latched" }, ...definition.ports.slice(1)]
        }
      ])?.message
    ).toContain("expected latched");

    const syntheticParseResult = {
      ...parseResult,
      resolvedKind: "synthetic.object",
      instancePorts: [{ id: "p", direction: "input", type: "boolean", activation: "trigger" }] satisfies ObjectTextPortV01[]
    };
    const syntheticDefinition = {
      ...definition,
      id: "synthetic.object",
      ports: [
        {
          id: "p",
          direction: "input",
          label: "P",
          type: { flow: "value", dataKind: "boolean", format: "bool8" },
          required: false,
          activation: "trigger"
        }
      ] satisfies PortV01[]
    };

    expect(objectTextRegistryDiagnostic(syntheticParseResult, [syntheticDefinition])?.message).toContain("uses format none");
    expect(
      objectTextRegistryDiagnostic(
        { ...syntheticParseResult, instancePorts: [{ id: "p", direction: "input", type: "boolean", activation: "passive" }] },
        [{ ...syntheticDefinition, ports: [{ ...syntheticDefinition.ports[0], type: { flow: "value", dataKind: "boolean" } }] }]
      )?.message
    ).toContain("uses activation none");
    expect(
      objectTextRegistryDiagnostic(
        syntheticParseResult,
        [{ ...syntheticDefinition, ports: [{ ...syntheticDefinition.ports[0], type: { flow: "value", dataKind: "boolean" }, activation: undefined }] }]
      )?.message
    ).toContain("expected none");
  });

  it("keeps only graph-supported activation values", () => {
    expect(
      objectTextPortToGraphPort({
        id: "passive",
        direction: "input",
        type: "number.float",
        activation: "passive"
      })
    ).not.toHaveProperty("activation");
  });
});
