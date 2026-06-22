// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "../../graph/patchLibrary";
import type { NodeCardView } from "../node/nodeTypes";
import { genericObjectTextForNode } from "../../graph/objectTextDisplay";
import { UNRESOLVED_OBJECT_NODE_KIND } from "../../graph/objectTextNode";
import { ObjectNodeRenderer, isPrimaryPointerButton } from "./ObjectNodeRenderer";

describe("ObjectNodeRenderer interaction guards", () => {
  it("starts value drags only from the primary pointer button", () => {
    expect(isPrimaryPointerButton(0)).toBe(true);
    expect(isPrimaryPointerButton(1)).toBe(false);
    expect(isPrimaryPointerButton(2)).toBe(false);
  });

  it("lets message activation clicks also select the React Flow node", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let selectedClicks = 0;
    const controls: unknown[] = [];
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(
          "div",
          { onClick: () => selectedClicks += 1 },
          createElement(ObjectNodeRenderer, {
            card: card(),
            node: messageNode(),
            onObjectControl: (...args) => controls.push(args),
            runtimeControlEnabled: true
          })
        )
      );
    });

    const messageObject = Array.from(container.querySelectorAll("div")).find((element) =>
      String(element.className).includes("messageObject")
    );
    if (!messageObject) {
      throw new Error("message object not found");
    }

    await act(async () => {
      messageObject.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(controls).toEqual([
      ["message_1", "in", { selector: "bang", atoms: [] }]
    ]);
    expect(selectedClicks).toBe(1);

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });

  it("renders unloaded assets as a plain 4:3 file-pick box", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ObjectNodeRenderer, {
          card: assetCard(),
          layoutEditable: true,
          node: assetNode({
            height: 720,
            width: 320
          }),
          onImportAsset: () => undefined,
          onObjectParamChange: () => undefined
        })
      );
    });

    const assetObject = Array.from(container.querySelectorAll("div")).find((element) =>
      String(element.className).includes("assetObject")
    );
    const fileInput = container.querySelector("input[type='file']");

    expect(assetObject?.getAttribute("style")).toContain("height: 240px");
    expect(assetObject?.getAttribute("style")).toContain("width: 320px");
    expect(container.textContent).not.toContain("asset.video");
    expect(fileInput?.getAttribute("accept")).toBe("video/*");

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });
});

describe("generic object text", () => {
  it("uses explicit object text before display labels", () => {
    expect(
      genericObjectTextForNode(
        genericNode("core.video-decode", {
          label: "Decode",
          objectText: "video.decode"
        })
      )
    ).toBe("video.decode");
  });

  it("falls back to labels, then node kind, without adding card metadata", () => {
    expect(genericObjectTextForNode(genericNode("core.gpu-upload", { label: "Upload" }))).toBe("upload");
    expect(genericObjectTextForNode(genericNode("core.preview", {}))).toBe("preview");
    expect(genericObjectTextForNode(genericNode("user.manipulator", { label: "Manipulator" }))).toBe("Manipulator");
  });

  it("commits generic object text edits from double click input", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onObjectTextCommit = vi.fn();
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ObjectNodeRenderer, {
          card: genericCard(),
          layoutEditable: true,
          node: genericNode("core.video-decode", { label: "Decode" }),
          onObjectTextCommit
        })
      );
    });

    const genericObject = Array.from(container.querySelectorAll("div")).find((element) =>
      String(element.className).includes("genericObject")
    );
    if (!genericObject) {
      throw new Error("generic object not found");
    }

    await act(async () => {
      genericObject.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    const input = container.querySelector("input[aria-label='Object text']") as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await act(async () => {
      input!.value = "upload";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(onObjectTextCommit).toHaveBeenCalledWith("node_1", "upload");

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });

  it("cancels generic object text edits on Escape", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const onObjectTextCommit = vi.fn();
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ObjectNodeRenderer, {
          card: genericCard(),
          layoutEditable: true,
          node: genericNode("core.video-decode", { label: "Decode" }),
          onObjectTextCommit
        })
      );
    });

    const genericObject = Array.from(container.querySelectorAll("div")).find((element) =>
      String(element.className).includes("genericObject")
    );
    await act(async () => {
      genericObject?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    const input = container.querySelector("input[aria-label='Object text']") as HTMLInputElement;

    await act(async () => {
      input.value = "upload";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onObjectTextCommit).not.toHaveBeenCalled();
    expect(container.querySelector("input[aria-label='Object text']")).toBeNull();

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });

  it("marks unresolved objects with warning styling and preserved text", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(ObjectNodeRenderer, {
          card: genericCard(),
          layoutEditable: true,
          node: genericNode(UNRESOLVED_OBJECT_NODE_KIND, {
            objectText: "user.manipulator",
            diagnosticMessage: "user.manipulator is unavailable"
          }),
          onObjectTextCommit: () => undefined
        })
      );
    });

    const genericObject = Array.from(container.querySelectorAll("div")).find((element) =>
      String(element.className).includes("genericObject")
    );
    expect(genericObject?.className).toContain("unresolvedObject");
    expect(genericObject?.getAttribute("title")).toBe("user.manipulator is unavailable");
    expect(container.textContent).toContain("user.manipulator");

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });
});

function card(): NodeCardView {
  return {
    id: "message_1",
    label: "Message",
    kind: "core.message",
    kindVersion: "0.1.0",
    inputs: [],
    outputs: []
  };
}

function messageNode(): GraphNodeV01 {
  return {
    id: "message_1",
    kind: "core.message",
    kindVersion: "0.1.0",
    params: {
      value: "perform"
    },
    ports: []
  };
}

function assetCard(): NodeCardView {
  return {
    id: "asset_1",
    label: "Asset",
    kind: "core.video-asset",
    kindVersion: "0.1.0",
    inputs: [],
    outputs: []
  };
}

function assetNode(params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "asset_1",
    kind: "core.video-asset",
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}

function genericCard(): NodeCardView {
  return {
    id: "node_1",
    label: "Object",
    kind: "core.video-decode",
    kindVersion: "0.1.0",
    inputs: [],
    outputs: []
  };
}

function genericNode(kind: string, params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "node_1",
    kind,
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}
