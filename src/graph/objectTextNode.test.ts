import { describe, expect, it } from "vitest";
import type { GraphNodeV01, NodeDefinitionManifestV01 } from "@skenion/contracts";
import { nodeRegistry } from "../data/registry";
import { createPatchLibraryV02, type PatchDefinitionV02 } from "./patchLibrary";
import {
  createGraphNodeFromObjectText,
  UNRESOLVED_OBJECT_NODE_KIND,
  objectTextRegistryDiagnostic,
  objectTextPortToGraphPort,
  objectTextTypeToGraphType
} from "./objectTextNode";
import { genericObjectTextForNode } from "./objectTextDisplay";

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

  it("preserves object text port descriptions in graph ports", () => {
    expect(
      objectTextPortToGraphPort({
        id: "pitch",
        direction: "input",
        type: "number.float",
        description: "Pitch in MIDI note numbers."
      })
    ).toMatchObject({
      id: "pitch",
      description: "Pitch in MIDI note numbers."
    });
  });

  it("allows object text instance ports to specialize a registry object class", () => {
    const result = createGraphNodeFromObjectText("*~ 0.5", [], nodeRegistry);

    expect(result.ok).toBe(true);
    expect(result.node?.kind).toBe("audio.operator.mul");
    expect(result.node?.ports.map((port) => port.id)).toEqual(["in", "right", "out"]);
  });

  it("allows registry-compatible object text interfaces", () => {
    const add = createGraphNodeFromObjectText("+ 1", [], nodeRegistry);
    const oscillator = createGraphNodeFromObjectText("osc~ 440", [], nodeRegistry);

    expect(add.ok).toBe(true);
    expect(add.node?.kind).toBe("core.operator.add");
    expect(oscillator.ok).toBe(true);
    expect(oscillator.node?.kind).toBe("audio.osc");
  });

  it("preserves invalid or deferred object text as unresolved nodes", () => {
    const invalid = createGraphNodeFromObjectText("sin~", []);
    const empty = createGraphNodeFromObjectText("", []);

    expect(invalid.ok).toBe(false);
    expect(invalid.node).toMatchObject({
      kind: UNRESOLVED_OBJECT_NODE_KIND,
      params: {
        objectText: "sin~",
        requestedKind: "sin~"
      },
      ports: []
    });
    expect(invalid.diagnostics[0]?.code).toBe("deferred-object");
    expect(empty.ok).toBe(false);
    expect(empty.node).toBeNull();
  });

  it("resolves lowercase native aliases through the local registry", () => {
    const decode = createGraphNodeFromObjectText("decode", [], nodeRegistry);
    const upload = createGraphNodeFromObjectText("upload", [], nodeRegistry);
    const preview = createGraphNodeFromObjectText("preview", [], nodeRegistry);

    expect(decode).toMatchObject({ ok: true, node: { kind: "core.video-decode" } });
    expect(upload).toMatchObject({ ok: true, node: { kind: "core.gpu-upload" } });
    expect(preview).toMatchObject({ ok: true, node: { kind: "core.preview" } });
    expect(genericObjectTextForNode(decode.node!)).toBe("decode");
    expect(genericObjectTextForNode(upload.node!)).toBe("upload");
    expect(genericObjectTextForNode(preview.node!)).toBe("preview");
  });

  it("normalizes bracketed native aliases and reports missing native definitions", () => {
    const missingDecode = createGraphNodeFromObjectText(
      "[decode]",
      [],
      nodeRegistry.filter((definition) => definition.id !== "core.video-decode")
    );

    expect(missingDecode.ok).toBe(false);
    expect(missingDecode.node).toMatchObject({
      kind: UNRESOLVED_OBJECT_NODE_KIND,
      params: {
        objectText: "decode",
        requestedKind: "core.video-decode"
      }
    });
    expect(missingDecode.diagnostics[0]).toMatchObject({
      code: "unavailable-object-kind"
    });
  });

  it("mirrors native alias port activation and defaults into parse results", () => {
    const registryWithDefault = nodeRegistry.map((definition): NodeDefinitionManifestV01 => {
      if (definition.id !== "core.video-decode") {
        return definition;
      }
      return {
        ...definition,
        ports: definition.ports.map((port, index) =>
          index === 0
            ? {
                ...port,
                activation: "latched",
                default: "fixture"
              }
            : port
        )
      };
    });

    const result = createGraphNodeFromObjectText("[decode]", [], registryWithDefault);

    expect(result.ok).toBe(true);
    expect(result.parseResult.displayText).toBe("decode");
    expect(result.parseResult.instancePorts[0]).toMatchObject({
      activation: "latched",
      defaultValue: "fixture"
    });
  });

  it("falls back from blank object text to label and kind display text", () => {
    const node: GraphNodeV01 = {
      id: "sensor_1",
      kind: "user.sensor",
      kindVersion: "0.1.0",
      params: {},
      ports: []
    };

    expect(genericObjectTextForNode({ ...node, params: { objectText: "  ", label: "Temperature" } })).toBe("Temperature");
    expect(genericObjectTextForNode({ ...node, params: { objectText: "  ", label: " " } })).toBe("user.sensor");
  });

  it("keeps namespaced extension candidates and warns namespace-less unknown classes", () => {
    const extension = createGraphNodeFromObjectText("user.manipulator", [], nodeRegistry);
    const unknown = createGraphNodeFromObjectText("manipulator", [], nodeRegistry);

    expect(extension.ok).toBe(false);
    expect(extension.node).toMatchObject({
      kind: UNRESOLVED_OBJECT_NODE_KIND,
      params: {
        objectText: "user.manipulator",
        requestedKind: "user.manipulator"
      }
    });
    expect(extension.diagnostics[0]).toMatchObject({
      code: "unavailable-object-kind"
    });
    expect(unknown.node).toMatchObject({
      kind: UNRESOLVED_OBJECT_NODE_KIND,
      params: {
        objectText: "manipulator",
        requestedKind: "manipulator"
      }
    });
    expect(unknown.diagnostics[0]).toMatchObject({
      code: "extension-namespace-required"
    });
  });

  it("resolves p object text through the internal patch library", () => {
    const patch: PatchDefinitionV02 = {
      id: "voice",
      revision: "1",
      metadata: {
        title: "Voice",
        description: "Reusable synth voice."
      },
      graph: {
        schema: "skenion.graph",
        schemaVersion: "0.2.0",
        id: "voice-help",
        revision: "1",
        nodes: [
          {
            id: "pitch_in",
            kind: "core.inlet",
            kindVersion: "0.2.0",
            params: { portId: "pitch", label: "Pitch" },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float",
                rate: "control",
                triggerMode: "latched",
                defaultValue: 69,
                description: "Pitch in MIDI note numbers."
              }
            ]
          },
          {
            id: "audio_out",
            kind: "core.outlet",
            kindVersion: "0.2.0",
            params: { portId: "out", label: "Out" },
            ports: [
              {
                id: "in",
                direction: "input",
                type: "signal.audio",
                rate: "audio",
                description: "Generated audio signal."
              }
            ]
          }
        ],
        edges: []
      }
    };
    const result = createGraphNodeFromObjectText("p voice", [], nodeRegistry, {
      patchLibrary: createPatchLibraryV02([patch])
    });

    expect(result.ok).toBe(true);
    expect(result.node).toMatchObject({
      id: "voice_1",
      kind: "core.subpatch",
      kindVersion: "0.2.0",
      params: {
        label: "p voice",
        objectText: "p voice",
        patchId: "voice",
        patchRevision: "1",
        description: "Reusable synth voice."
      },
      ports: [
        {
          id: "pitch",
          direction: "input",
          type: { flow: "value", dataKind: "number.float", format: "f32" },
          activation: "latched",
          description: "Pitch in MIDI note numbers."
        },
        {
          id: "out",
          direction: "output",
          type: { flow: "signal", dataKind: "signal.audio" },
          description: "Generated audio signal."
        }
      ]
    });
    expect(result.parseResult).toMatchObject({
      ok: true,
      classSymbol: "p",
      creationArgs: [{ type: "symbol", value: "voice" }],
      resolvedKind: "core.subpatch",
      resolvedKindVersion: "0.2.0",
      params: { patchId: "voice" },
      instancePorts: [
        {
          id: "pitch",
          direction: "input",
          type: "number.float",
          defaultValue: 69,
          description: "Pitch in MIDI note numbers."
        },
        { id: "out", direction: "output", type: "signal.audio", description: "Generated audio signal." }
      ]
    });
  });

  it("keeps optional subpatch parse metadata absent for bare boundary ports", () => {
    const patch: PatchDefinitionV02 = {
      id: "bare",
      revision: "1",
      graph: {
        schema: "skenion.graph",
        schemaVersion: "0.2.0",
        id: "bare-help",
        revision: "1",
        nodes: [
          {
            id: "input",
            kind: "core.inlet",
            kindVersion: "0.2.0",
            params: { portId: "in" },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "message.any"
              }
            ]
          }
        ],
        edges: []
      }
    };
    const result = createGraphNodeFromObjectText("p bare", [], nodeRegistry, {
      patchLibrary: createPatchLibraryV02([patch])
    });

    expect(result.ok).toBe(true);
    expect(result.parseResult.instancePorts[0]).toEqual({
      id: "in",
      direction: "input",
      type: "message.any"
    });
  });

  it("keeps missing patch references editable as unresolved object nodes", () => {
    const missingLibrary = createGraphNodeFromObjectText("p missing", [], nodeRegistry, {
      patchLibrary: createPatchLibraryV02([])
    });
    const unavailableLibrary = createGraphNodeFromObjectText("p missing", [], nodeRegistry);

    expect(missingLibrary.ok).toBe(false);
    expect(missingLibrary.node).toMatchObject({
      kind: UNRESOLVED_OBJECT_NODE_KIND,
      params: {
        objectText: "p missing",
        requestedKind: "core.subpatch"
      }
    });
    expect(missingLibrary.diagnostics[0]).toMatchObject({
      code: "patch-definition-unavailable"
    });
    expect(unavailableLibrary.diagnostics[0]).toMatchObject({
      code: "patch-library-unavailable"
    });

    const missingPatchId = createGraphNodeFromObjectText("p", [], nodeRegistry, {
      patchLibrary: createPatchLibraryV02([])
    });
    const tooManyArgs = createGraphNodeFromObjectText("p voice extra", [], nodeRegistry, {
      patchLibrary: createPatchLibraryV02([])
    });

    expect(missingPatchId.diagnostics[0]).toMatchObject({
      code: "missing-subpatch-id"
    });
    expect(tooManyArgs.diagnostics[0]).toMatchObject({
      code: "invalid-subpatch-object-text"
    });
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
    const missingKindResult = createGraphNodeFromObjectText(
      "+ 1",
      [],
      nodeRegistry.filter((definition) => definition.id !== "core.operator.add")
    );

    expect(objectTextRegistryDiagnostic(parseResult, [])).toBeNull();
    expect(objectTextRegistryDiagnostic({ ...parseResult, ok: false }, nodeRegistry)).toBeNull();
    expect(objectTextRegistryDiagnostic({ ...parseResult, resolvedKind: null }, nodeRegistry)).toBeNull();
    expect(objectTextRegistryDiagnostic({ ...parseResult, resolvedKindVersion: null }, nodeRegistry)).toBeNull();
    expect(objectTextRegistryDiagnostic(parseResult, nodeRegistry.filter((definition) => definition.id !== "core.operator.add"))).toMatchObject({
      code: "unavailable-object-kind"
    });
    expect(missingKindResult).toMatchObject({
      ok: false,
      node: {
        kind: UNRESOLVED_OBJECT_NODE_KIND,
        params: {
          objectText: "+ 1",
          requestedKind: "core.operator.add"
        }
      }
    });
    expect(missingKindResult.diagnostics.at(-1)).toMatchObject({
      code: "unavailable-object-kind"
    });
  });

  it("does not reject parser-owned dynamic ports against static registry ports", () => {
    const parseResult = createGraphNodeFromObjectText("+ 1", []).parseResult;
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.operator.add")!;

    expect(objectTextRegistryDiagnostic(parseResult, [{ ...definition, ports: definition.ports.slice(0, 2) }])).toBeNull();
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
