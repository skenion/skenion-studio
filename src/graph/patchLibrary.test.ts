import { describe, expect, it } from "vitest";
import type { PatchDefinitionV01 } from "./patchLibrary";
import {
  createPatchLibrary,
  createSubpatchNodeFromDefinition,
  findPatchDefinition,
  displayGraphToContractGraph,
  contractGraphToDisplayGraph,
  graphPortToPortSpec,
  isPatchDefinition,
  patchDisplayName,
  patchDefinitionToDisplayGraph,
  patchTags,
  portSpecToGraphPort,
  SUBPATCH_NODE_KIND
} from "./patchLibrary";

describe("patchLibrary", () => {
  it("models and looks up internal current 0.1 patch definitions", () => {
    const patch = testPatchDefinition();
    const library = createPatchLibrary([patch]);

    expect(library).toEqual({ patches: [patch] });
    expect(isPatchDefinition(patch)).toBe(true);
    expect(isPatchDefinition({})).toBe(false);
    expect(findPatchDefinition(library, "voice")).toBe(patch);
    expect(findPatchDefinition(undefined, "voice")).toBeNull();
    expect(findPatchDefinition(library, "missing")).toBeNull();
    expect(patchDisplayName(patch)).toBe("Voice");
    expect(patchDisplayName({ ...patch, metadata: { title: "  " } })).toBe("voice");
    expect(patchTags(patch)).toEqual(["patch"]);
    expect(patchTags({ ...patch, metadata: { tags: ["patch", 3] } })).toEqual(["patch"]);
    expect(patchTags({ ...patch, metadata: {} })).toEqual([]);
  });

  it("creates a core.subpatch node from patch boundary ports", () => {
    const patch = testPatchDefinition();
    const node = createSubpatchNodeFromDefinition(patch, [], { objectText: "p voice" });

    expect(node).toMatchObject({
      id: "voice_1",
      kind: SUBPATCH_NODE_KIND,
      kindVersion: "0.1.0",
      params: {
        label: "p voice",
        objectText: "p voice",
        patchId: "voice",
        patchRevision: "3",
        description: "Simple reusable voice."
      }
    });
    expect(node.ports).toEqual([
      {
        id: "pitch",
        direction: "input",
        label: "Pitch",
        type: { flow: "value", dataKind: "number.float", format: "f32" },
        required: true,
        rate: "control",
        accepts: ["number.int"],
        minConnections: 1,
        maxConnections: 1,
        mergePolicy: "forbid",
        triggerMode: "latched",
        description: "Pitch in MIDI note numbers.",
        activation: "latched"
      },
      {
        id: "audio",
        direction: "output",
        label: "Audio",
        type: { flow: "signal", dataKind: "signal.audio" },
        required: false,
        rate: "audio",
        fanOutPolicy: "allow",
        description: "Generated audio signal."
      }
    ]);

    const collision = createSubpatchNodeFromDefinition(patch, [{ ...node, id: "voice_2" }], { objectText: "p voice" });
    expect(collision.id).toBe("voice_3");
  });

  it("omits optional subpatch node metadata when the patch does not provide it", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      metadata: { title: "  ", description: "  " }
    };
    const node = createSubpatchNodeFromDefinition(patch, [], {
      nodeId: "custom_voice",
      objectText: "p voice"
    });

    expect(node.id).toBe("custom_voice");
    expect(node.params).not.toHaveProperty("description");
  });

  it("uses default object text and a fallback node id for symbolic patch ids", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      id: "---"
    };
    const node = createSubpatchNodeFromDefinition(patch, []);

    expect(node.id).toBe("subpatch_1");
    expect(node.params.label).toBe("p ---");
    expect(node.params.objectText).toBe("p ---");
  });

  it("maps standalone current 0.1 color ports through the v0.1 display adapter", () => {
    expect(
      portSpecToGraphPort({
        id: "tint",
        direction: "input",
        type: "color",
        rate: "control"
      })
    ).toMatchObject({
      id: "tint",
      type: { flow: "value", dataKind: "color", format: "rgba32f" }
    });

    expect(
      portSpecToGraphPort({
        id: "count",
        direction: "input",
        type: "number.int",
        rate: "control"
      }).type
    ).toEqual({ flow: "value", dataKind: "number.int", format: "i32" });
    expect(
      portSpecToGraphPort({
        id: "index",
        direction: "input",
        type: "number.uint",
        rate: "control"
      }).type
    ).toEqual({ flow: "value", dataKind: "number.uint", format: "u32" });
    expect(
      portSpecToGraphPort({
        id: "asset",
        direction: "output",
        type: "resource.asset.video",
        rate: "resource"
      }).type
    ).toEqual({ flow: "resource", dataKind: "asset.video" });
    expect(
      portSpecToGraphPort({
        id: "frame",
        direction: "output",
        type: "video.frame"
      }).type
    ).toEqual({ flow: "stream", dataKind: "video.frame" });
    expect(
      portSpecToGraphPort({
        id: "velocity",
        direction: "input",
        type: "value.velocity"
      }).type
    ).toEqual({ flow: "value", dataKind: "velocity" });
    expect(
      portSpecToGraphPort({
        id: "depth",
        direction: "input",
        type: "stream.depth"
      }).type
    ).toEqual({ flow: "stream", dataKind: "depth" });
    expect(
      portSpecToGraphPort({
        id: "latched",
        direction: "input",
        type: "message.any",
        latch: true
      }).activation
    ).toBe("latched");
  });

  it("maps display-only v0.1 port type hints back into current 0.1 port specs", () => {
    const graph = displayGraphToContractGraph({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "port-types",
      revision: "1",
      nodes: [
        {
          id: "types",
          kind: "core.types",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "audio",
              direction: "output",
              type: { flow: "signal", dataKind: "signal.audio" }
            },
            {
              id: "buffer",
              direction: "output",
              type: { flow: "resource", dataKind: "buffer.mesh" }
            },
            {
              id: "frame",
              direction: "output",
              type: { flow: "resource", dataKind: "render.frame" }
            },
            {
              id: "custom",
              direction: "input",
              type: { flow: "value", dataKind: "custom.scalar" }
            }
          ]
        }
      ],
      edges: []
    });

    expect(graph.nodes[0]?.ports.map((port) => ({ id: port.id, rate: port.rate, type: port.type }))).toEqual([
      { id: "audio", rate: "audio", type: "signal.audio" },
      { id: "buffer", rate: "resource", type: "resource.buffer.mesh" },
      { id: "frame", rate: "render", type: "render.frame" },
      { id: "custom", rate: "control", type: "value.custom.scalar" }
    ]);
    expect(
      graphPortToPortSpec({
        id: "fallback-default",
        direction: "input",
        type: { flow: "value", dataKind: "number.float", format: "f32" },
        defaultValue: 0.5
      } as Parameters<typeof graphPortToPortSpec>[0] & { defaultValue: number }).defaultValue
    ).toBe(0.5);
    expect(
      graphPortToPortSpec({
        id: "legacy-default",
        direction: "input",
        type: { flow: "value", dataKind: "number.float", format: "f32" },
        default: 0.75
      }).defaultValue
    ).toBe(0.75);
  });

  it("converts current 0.1 graphs to readonly v0.1 display graphs", () => {
    const patch = testPatchDefinition();
    const graph = patchDefinitionToDisplayGraph(patch);

    expect(graph).toMatchObject({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "voice-help",
      revision: "3"
    });
    expect(graph.nodes[1]?.ports[0]).toMatchObject({
      id: "bang",
      type: { flow: "event", dataKind: "event.bang" },
      triggerMode: "trigger",
      description: "Start the envelope."
    });
    expect((graph.nodes[1] as typeof graph.nodes[number] & { portGroups?: unknown }).portGroups).toEqual([
      { id: "control", direction: "output", type: "event.bang", minPorts: 1, label: "Control" }
    ]);
    expect(graph.nodes[3]?.ports[0]).toMatchObject({
      id: "out",
      type: { flow: "resource", dataKind: "render.frame" },
      rate: "render",
      description: "Rendered frame."
    });
    expect(graph.edges[0]).toMatchObject({
      from: { node: "trigger", port: "bang" },
      to: { node: "display", port: "out" },
      id: "edge_trigger_display",
      label: "demo",
      feedback: { enabled: true, boundary: "render-frame" }
    });
  });

  it("converts bare current 0.1 graph documents for helper consumers", () => {
    const graph = contractGraphToDisplayGraph(testPatchDefinition().graph);
    const plainEdgeGraph = contractGraphToDisplayGraph({
      ...testPatchDefinition().graph,
      edges: [
        {
          id: "plain_edge",
          source: { nodeId: "trigger", portId: "bang" },
          target: { nodeId: "display", portId: "out" }
        }
      ]
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(["pitch_in", "trigger", "audio_out", "display"]);
    expect(plainEdgeGraph.edges[0]).not.toHaveProperty("feedback");
  });

  it("converts display graphs back into active current 0.1 graphs without losing metadata", () => {
    const displayGraph = patchDefinitionToDisplayGraph(testPatchDefinition());
    const activeGraph = displayGraphToContractGraph(displayGraph);

    expect(activeGraph.schemaVersion).toBe("0.1.0");
    expect(activeGraph.nodes[1]?.ports[0]).toMatchObject({
      id: "bang",
      type: "event.bang",
      rate: "event",
      triggerMode: "trigger",
      description: "Start the envelope."
    });
    expect(activeGraph.nodes[1]?.portGroups).toEqual([
      { id: "control", direction: "output", type: "event.bang", minPorts: 1, label: "Control" }
    ]);
    expect(activeGraph.edges[0]).toMatchObject({
      id: "edge_trigger_display",
      source: { nodeId: "trigger", portId: "bang" },
      target: { nodeId: "display", portId: "out" },
      label: "demo",
      feedback: { enabled: true, boundary: "render-frame" }
    });
  });
});

function testPatchDefinition(): PatchDefinitionV01 {
  return {
    id: "voice",
    revision: "3",
    metadata: {
      title: "Voice",
      description: "Simple reusable voice.",
      tags: ["patch"]
    },
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "voice-help",
      revision: "3",
      nodes: [
        {
          id: "pitch_in",
          kind: "core.inlet",
          kindVersion: "0.1.0",
          params: { portId: "pitch", label: "Pitch" },
          ports: [
            {
              id: "out",
              direction: "output",
              type: "number.float",
              rate: "control",
              accepts: ["number.int"],
              minConnections: 1,
              maxConnections: 1,
              mergePolicy: "forbid",
              triggerMode: "latched",
              description: "Pitch in MIDI note numbers."
            }
          ]
        },
        {
          id: "trigger",
          kind: "core.bang",
          kindVersion: "0.1.0",
          params: { label: "Trigger" },
          portGroups: [{ id: "control", direction: "output", type: "event.bang", minPorts: 1, label: "Control" }],
          ports: [
            {
              id: "bang",
              direction: "output",
              type: "event.bang",
              rate: "event",
              triggerMode: "trigger",
              description: "Start the envelope."
            }
          ]
        },
        {
          id: "audio_out",
          kind: "core.outlet",
          kindVersion: "0.1.0",
          params: { portId: "audio", label: "Audio" },
          ports: [
            {
              id: "in",
              direction: "input",
              type: "signal.audio",
              rate: "audio",
              fanOutPolicy: "allow",
              description: "Generated audio signal."
            }
          ]
        },
        {
          id: "display",
          kind: "render.output",
          kindVersion: "0.1.0",
          params: { label: "Output" },
          ports: [
            {
              id: "out",
              direction: "input",
              type: "render.frame",
              rate: "render",
              description: "Rendered frame."
            }
          ]
        }
      ],
      edges: [
        {
          id: "edge_trigger_display",
          source: { nodeId: "trigger", portId: "bang" },
          target: { nodeId: "display", portId: "out" },
          feedback: { enabled: true, boundary: "render-frame" },
          label: "demo"
        }
      ]
    }
  };
}
