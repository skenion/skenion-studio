// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import type { DisplayGraphDocumentV01 as GraphDocumentV01 } from "../../graph/patchLibrary";
import type { GraphSemanticDiagnostic } from "../../graph/portSemantics";
import { theme } from "../../theme";
import {
  LogConsole,
  clientLogLine,
  filterLogLines,
  logLinesFromRuntimeState,
  mergeLogLines,
  runtimeLogLineFromEvent
} from "./LogConsole";

describe("LogConsole", () => {
  it("renders client and runtime messages as timestamped read-only log lines", () => {
    const lines = logLinesFromRuntimeState({
      error: null,
      info: { apiVersion: "0.1.0", capabilities: [], name: "skenion-runtime", version: "0.34.0" },
      observedAt: "2026-06-21T07:00:00.000Z",
      previewStatus: null,
      result: null,
      semanticDiagnostics: [diagnostic("warning", "implicit-conversion", "Implicit conversion planned.")],
      session: null,
      status: "connected",
      telemetry: null,
      validation: { ok: true, value: graph() }
    });
    const html = renderToStaticMarkup(
      createElement(MantineProvider, { theme }, createElement(LogConsole, { lines }))
    );

    expect(lines.map((line) => `${line.source}:${line.message}`)).toContain(
      "client:graph diagnostics: 0 errors, 1 warnings"
    );
    expect(lines.map((line) => `${line.source}:${line.message}`)).toContain(
      "runtime:skenion-runtime 0.34.0 api 0.1.0"
    );
    expect(html).toContain("role=\"log\"");
    expect(html).toContain("dateTime=\"2026-06-21T07:00:00.000Z\"");
    expect(html).not.toContain("Undo");
    expect(html).not.toContain("Refresh History");
  });

  it("sorts log lines by time and filters runtime-only views", () => {
    const merged = mergeLogLines([
      clientLogLine("late", "error", "Browser error", "2026-06-21T07:00:02.000Z"),
      runtimeLineForTest("early", "info", "Runtime boot", "2026-06-21T07:00:01.000Z")
    ]);

    expect(merged.map((line) => line.message)).toEqual(["Runtime boot", "Browser error"]);
    expect(filterLogLines(merged, "runtime").map((line) => line.message)).toEqual(["Runtime boot"]);
  });

  it("converts runtime log stream events and sorts unix-ms timestamps", () => {
    const streamLine = runtimeLogLineFromEvent({
      code: "io-device-enumeration-failed",
      id: 7,
      level: "error",
      message: "device enumeration failed",
      source: "runtime",
      timestamp: "unix-ms:1782015601000"
    });
    const merged = mergeLogLines([
      clientLogLine("later", "info", "Client later", "2026-06-21T07:00:02.000Z"),
      streamLine
    ]);

    expect(streamLine).toMatchObject({
      id: "runtime:stream-7",
      message: "io-device-enumeration-failed: device enumeration failed",
      source: "runtime"
    });
    expect(merged.map((line) => line.message)).toEqual([
      "io-device-enumeration-failed: device enumeration failed",
      "Client later"
    ]);
  });

  it("updates the visible stream when the source filter changes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(
          MantineProvider,
          { theme },
          createElement(LogConsole, {
            lines: [
              clientLogLine("client", "error", "Browser error", "2026-06-21T07:00:02.000Z"),
              runtimeLineForTest("runtime", "info", "Runtime boot", "2026-06-21T07:00:01.000Z")
            ]
          })
        )
      );
    });

    const runtimeFilter = Array.from(container.querySelectorAll("input")).find(
      (input) => (input as HTMLInputElement).value === "runtime"
    ) as HTMLInputElement | undefined;
    if (!runtimeFilter) {
      throw new Error("runtime filter not found");
    }

    await act(async () => {
      runtimeFilter.click();
      runtimeFilter.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Runtime boot");
    expect(container.textContent).not.toContain("Browser error");

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });

  it("includes schema errors and runtime result diagnostics without controls", () => {
    const lines = logLinesFromRuntimeState({
      error: "Runtime request failed",
      info: null,
      observedAt: "2026-06-21T07:00:00.000Z",
      previewStatus: null,
      result: {
        kind: "validateSession",
        receivedAt: "2026-06-21T07:00:01.000Z",
        response: {
          diagnostics: [{ message: "Invalid graph", severity: "error" }],
          snapshot: {
            sessionRevision: 1,
            viewRevision: 0,
            controlRevision: 0,
            project: null,
            diagnostics: [],
            plan: null
          },
          ok: false,
          report: null
        }
      },
      semanticDiagnostics: [],
      session: null,
      status: "error",
      telemetry: null,
      validation: { errors: ["missing node"], ok: false }
    });

    expect(lines.some((line) => line.source === "client" && line.message === "graph schema: missing node")).toBe(true);
    expect(lines.some((line) => line.source === "runtime" && line.message === "Invalid graph")).toBe(true);
  });
});

function runtimeLineForTest(
  id: string,
  level: "info" | "warning" | "error",
  message: string,
  timestamp: string
) {
  return {
    id: `runtime:${id}`,
    level,
    message,
    source: "runtime" as const,
    timestamp
  };
}

function diagnostic(
  severity: GraphSemanticDiagnostic["severity"],
  code: string,
  message: string
): GraphSemanticDiagnostic {
  return {
    code,
    message,
    severity
  };
}

function graph(): GraphDocumentV01 {
  return {
    edges: [],
    id: "graph",
    nodes: [],
    revision: "0",
    schema: "skenion.graph",
    schemaVersion: "0.1.0"
  };
}
