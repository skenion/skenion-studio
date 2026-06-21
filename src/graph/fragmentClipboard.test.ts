// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { GraphDocumentV01 } from "@skenion/contracts";
import {
  createGraphFragmentFromSelection,
  graphFragmentPasteAvailability,
  graphClipboardShortcutAction,
  parseGraphFragmentClipboard,
  serializeGraphFragmentClipboard
} from "./fragmentClipboard";
import { createVolatileHelpWorkingCopy, helpGraphDisplayDocument } from "../components/help/HelpGraphViewer";
import { createViewStateFromPositions } from "./projectDocument";

describe("fragmentClipboard", () => {
  it("preserves selected internal edges and omits selected outside endpoint edges", () => {
    const viewState = createViewStateFromPositions(testGraph, {
      source: { x: 10, y: 20 },
      middle: { x: 220, y: 20 },
      sink: { x: 430, y: 20 }
    });
    const result = createGraphFragmentFromSelection(testGraph, viewState, {
      nodeIds: ["source", "middle"],
      edgeIds: ["edge-source-middle", "edge-middle-sink"]
    }, {
      source: "root"
    });

    expect(result.fragment?.nodes.map((node) => node.id)).toEqual(["source", "middle"]);
    expect(result.fragment?.edges.map((edge) => edge.id)).toEqual(["edge-source-middle"]);
    expect(result.fragment?.omittedEdges).toEqual([
      {
        id: "edge-middle-sink",
        source: { nodeId: "middle", portId: "out" },
        target: { nodeId: "sink", portId: "in" },
        reason: "outside-fragment"
      }
    ]);
    expect(result.fragment?.view?.nodes?.source).toEqual({ x: 10, y: 20 });
    expect(result.fragment?.metadata?.source).toBe("root");
  });

  it("preserves internal edges when two connected nodes are selected without selected edge ids", () => {
    const result = createGraphFragmentFromSelection(
      testGraph,
      createViewStateFromPositions(testGraph, {}),
      {
        nodeIds: ["source", "middle"],
        edgeIds: []
      }
    );

    expect(result.fragment?.edges.map((edge) => edge.id)).toEqual(["edge-source-middle"]);
    expect(result.fragment?.omittedEdges).toEqual([]);
  });

  it("round trips clipboard JSON through contracts validation", () => {
    const result = createGraphFragmentFromSelection(
      testGraph,
      createViewStateFromPositions(testGraph, {}),
      { nodeIds: ["source", "middle"], edgeIds: ["edge-source-middle"] }
    );

    expect(result.fragment).not.toBeNull();
    const text = serializeGraphFragmentClipboard(result.fragment!);

    expect(parseGraphFragmentClipboard(text)?.edges[0]?.id).toBe("edge-source-middle");
    expect(parseGraphFragmentClipboard(JSON.stringify(result.fragment))?.nodes[0]?.id).toBe("source");
    expect(parseGraphFragmentClipboard(JSON.stringify({ type: "other", fragment: result.fragment }))).toBeNull();
    expect(parseGraphFragmentClipboard("{")).toBeNull();
  });

  it("maps all supported v0.1 port flow hints into v0.2 fragment ports", () => {
    const result = createGraphFragmentFromSelection(
      portFlowGraph,
      createViewStateFromPositions(portFlowGraph, {}),
      {
        edgeIds: ["resource_edge"],
        nodeIds: ["event", "signal", "resource", "stream", "latched", "resource_sink"]
      }
    );

    expect(result.fragment?.metadata).not.toHaveProperty("source");
    expect(result.fragment?.nodes.flatMap((node) => node.ports.map((port) => [port.id, port.rate]))).toEqual([
      ["event_out", "event"],
      ["signal_out", "audio"],
      ["resource_out", "resource"],
      ["stream_out", undefined],
      ["latched_in", "control"],
      ["resource_in", "resource"]
    ]);
    expect(result.fragment?.nodes[4]?.ports[0]).toMatchObject({
      triggerMode: "latched",
      latch: true
    });
    expect(result.fragment?.edges[0]).toMatchObject({
      adapter: "copy",
      enabled: true,
      label: "resource",
      resolvedType: "resource.asset.video"
    });
  });

  it("reports an empty selection instead of creating an invalid fragment", () => {
    const result = createGraphFragmentFromSelection(
      testGraph,
      createViewStateFromPositions(testGraph, {}),
      { nodeIds: [], edgeIds: [] }
    );

    expect(result.fragment).toBeNull();
    expect(result.diagnostics[0]?.code).toBe("empty-selection");
  });

  it("returns diagnostics when selected fragment validation fails", () => {
    const invalidGraph: GraphDocumentV01 = {
      ...testGraph,
      edges: [
        {
          from: { node: "source", port: "out" },
          to: { node: "middle", port: "missing" },
          id: "invalid-edge"
        } as GraphDocumentV01["edges"][number]
      ]
    };
    const result = createGraphFragmentFromSelection(
      invalidGraph,
      { schema: "skenion.view-state", schemaVersion: "0.1.0", canvas: { nodes: {} } },
      { nodeIds: ["source", "middle"], edgeIds: ["invalid-edge"] }
    );

    expect(result.fragment).toBeNull();
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "missing-target-port")).toBe(true);
  });

  it("keeps help source immutable while a volatile working copy can move and edit", () => {
    const source = testGraph;
    const workingCopy = createVolatileHelpWorkingCopy(source, {
      sourcePatchId: "core.float",
      workingCopyId: "help-work-copy-1"
    });
    const movedWorkingCopy = {
      ...workingCopy,
      viewState: {
        ...workingCopy.viewState,
        canvas: {
          ...workingCopy.viewState.canvas,
          nodes: {
            ...workingCopy.viewState.canvas.nodes,
            source: { x: 999, y: 777 }
          }
        }
      },
      graph: {
        ...workingCopy.graph,
        nodes: workingCopy.graph.nodes.map((node) =>
          node.id === "source"
            ? { ...node, params: { ...node.params, label: "Edited" } }
            : node
        )
      }
    };

    expect(helpGraphDisplayDocument(source).nodes[0]?.params.label).toBe("Source");
    expect(source).toBe(testGraph);
    expect(movedWorkingCopy.sourceGraph).toBe(source);
    expect(movedWorkingCopy.graph.nodes[0]?.params.label).toBe("Edited");
    expect(movedWorkingCopy.viewState.canvas.nodes.source).toEqual({ x: 999, y: 777 });
    expect(source.nodes[0]?.params.label).toBe("Source");
  });

  it("does not fire graph clipboard shortcuts inside text inputs", () => {
    const input = document.createElement("input");
    const select = document.createElement("select");
    const textarea = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    expect(graphClipboardShortcutAction(event({ key: "c", metaKey: true }))).toBe("copy");
    expect(graphClipboardShortcutAction(event({ key: "v", ctrlKey: true }))).toBe("paste");
    expect(graphClipboardShortcutAction(event({ key: "x", ctrlKey: true }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c" }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c", altKey: true, metaKey: true }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c", metaKey: true, target: input }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c", metaKey: true, target: select }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c", metaKey: true, target: textarea }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c", metaKey: true, target: editable }))).toBeNull();
    expect(graphClipboardShortcutAction(event({ key: "c", metaKey: true, shiftKey: true }))).toBeNull();
  });

  it("reports the runtime session.operation missing path before paste", () => {
    expect(
      graphFragmentPasteAvailability({
        capabilities: ["session.operation"],
        connected: false,
        sessionLoaded: true,
        sessionSynced: true
      })
    ).toEqual({ ok: false, reason: "Connect Runtime before pasting graph fragments." });
    expect(
      graphFragmentPasteAvailability({
        capabilities: ["session.operation"],
        connected: true,
        sessionLoaded: false,
        sessionSynced: true
      })
    ).toEqual({ ok: false, reason: "Load and sync a Runtime session before pasting graph fragments." });
    expect(
      graphFragmentPasteAvailability({
        capabilities: ["session.history"],
        connected: true,
        sessionLoaded: true,
        sessionSynced: true
      })
    ).toEqual({
      ok: false,
      reason: "Runtime does not support session.operation graph fragment paste."
    });

    expect(
      graphFragmentPasteAvailability({
        capabilities: ["session.operation"],
        connected: true,
        sessionLoaded: true,
        sessionSynced: true
      })
    ).toEqual({ ok: true });
  });
});

const testGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "fragment-test",
  revision: "1",
  nodes: [
    node("source", "Source", "output"),
    node("middle", "Middle", "both"),
    node("sink", "Sink", "input")
  ],
  edges: [
    {
      from: { node: "source", port: "out" },
      to: { node: "middle", port: "in" },
      id: "edge-source-middle"
    } as GraphDocumentV01["edges"][number],
    {
      from: { node: "middle", port: "out" },
      to: { node: "sink", port: "in" },
      id: "edge-middle-sink"
    } as GraphDocumentV01["edges"][number]
  ]
};

const portFlowGraph: GraphDocumentV01 = {
  schema: "skenion.graph",
  schemaVersion: "0.1.0",
  id: "port-flow-test",
  revision: "1",
  nodes: [
    flowNode("event", "event_out", { flow: "event", dataKind: "event.bang" }, "trigger"),
    flowNode("signal", "signal_out", { flow: "signal", dataKind: "signal.audio" }),
    flowNode("resource", "resource_out", { flow: "resource", dataKind: "resource.asset.video" }),
    flowNode("stream", "stream_out", { flow: "stream", dataKind: "video.frame" }),
    {
      id: "latched",
      kind: "core.float",
      kindVersion: "0.1.0",
      params: { label: "Latched" },
      ports: [
        {
          id: "latched_in",
          direction: "input",
          label: "Latched",
          type: { flow: "value", dataKind: "number.float", format: "f32" },
          activation: "latched"
        }
      ]
    },
    {
      id: "resource_sink",
      kind: "core.video-asset",
      kindVersion: "0.1.0",
      params: { label: "Resource Sink" },
      ports: [
        {
          id: "resource_in",
          direction: "input",
          label: "Resource",
          type: { flow: "resource", dataKind: "resource.asset.video" }
        }
      ]
    }
  ],
  edges: [
    {
      from: { node: "resource", port: "resource_out" },
      to: { node: "resource_sink", port: "resource_in" },
      id: "resource_edge",
      adapter: "copy",
      enabled: true,
      label: "resource",
      resolvedType: "resource.asset.video"
    } as GraphDocumentV01["edges"][number]
  ]
};

function node(id: string, label: string, ports: "input" | "output" | "both"): GraphDocumentV01["nodes"][number] {
  return {
    id,
    kind: "core.float",
    kindVersion: "0.1.0",
    params: { label },
    ports: [
      ...(ports === "input" || ports === "both"
        ? [
            {
              id: "in",
              direction: "input" as const,
              label: "In",
              type: { flow: "value" as const, dataKind: "number.float", format: "f32" }
            }
          ]
        : []),
      ...(ports === "output" || ports === "both"
        ? [
            {
              id: "out",
              direction: "output" as const,
              label: "Out",
              type: { flow: "value" as const, dataKind: "number.float", format: "f32" }
            }
          ]
        : [])
    ]
  };
}

function flowNode(
  id: string,
  portId: string,
  type: GraphDocumentV01["nodes"][number]["ports"][number]["type"],
  activation?: "trigger"
): GraphDocumentV01["nodes"][number] {
  return {
    id,
    kind: "core.float",
    kindVersion: "0.1.0",
    params: { label: id },
    ports: [
      {
        id: portId,
        direction: "output",
        label: portId,
        type,
        activation
      }
    ]
  };
}

function event(overrides: Partial<Parameters<typeof graphClipboardShortcutAction>[0]> = {}) {
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
