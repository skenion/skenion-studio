// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "../../graph/patchLibrary";
import { theme } from "../../theme";
import { NodeInspector } from "./NodeInspector";

describe("NodeInspector", () => {
  it("renders persistent object settings inline in the inspect surface", () => {
    const html = renderToStaticMarkup(
      createElement(MantineProvider, { theme }, createElement(NodeInspector, props()))
    );

    expect(html).toContain("Float");
    expect(html).toContain("Send name");
    expect(html).toContain("Receive name");
    expect(html).not.toContain("aria-label=\"Object Settings\"");
  });

  it("renders message object settings when a message node is selected", () => {
    const html = renderToStaticMarkup(
      createElement(MantineProvider, { theme }, createElement(NodeInspector, props(messageNode())))
    );

    expect(html).toContain("Message Graph Param");
    expect(html).toContain("Send name");
    expect(html).toContain("Receive name");
  });
});

function props(selectedNode = node()): Parameters<typeof NodeInspector>[0] {
  return {
    graphLocked: false,
    node: selectedNode,
    onImportAsset: async () => undefined,
    onRemoveNode: () => undefined,
    onSetNodeParam: () => undefined,
    onSyncShaderInputs: () => undefined,
    runtimeAssetImportBusy: false,
    runtimeAssetImportEnabled: false
  };
}

function messageNode(): GraphNodeV01 {
  return {
    id: "message_1",
    kind: "core.message",
    kindVersion: "0.1.0",
    params: {
      receiveName: "",
      sendName: "",
      value: ""
    },
    ports: [
      {
        id: "in",
        direction: "input",
        type: {
          dataKind: "message.any",
          flow: "event"
        }
      },
      {
        id: "out",
        direction: "output",
        type: {
          dataKind: "message.any",
          flow: "event"
        }
      }
    ]
  };
}

function node(): GraphNodeV01 {
  return {
    id: "float_1",
    kind: "core.float",
    kindVersion: "0.1.0",
    params: {
      label: "Float",
      receiveName: "",
      sendName: "speed",
      value: 0.5,
      widget: "number"
    },
    ports: [
      {
        id: "in",
        direction: "input",
        type: {
          dataKind: "number.float",
          flow: "value"
        }
      },
      {
        id: "value",
        direction: "output",
        type: {
          dataKind: "number.float",
          flow: "value"
        }
      }
    ]
  };
}
