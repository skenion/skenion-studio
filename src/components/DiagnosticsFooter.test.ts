// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import type { DisplayGraphDocumentV01 as GraphDocumentV01 } from "../graph/patchLibrary";
import type { GraphSemanticDiagnostic } from "../graph/portSemantics";
import { theme } from "../theme";
import { DiagnosticsFooter, diagnosticCounts } from "./DiagnosticsFooter";

describe("DiagnosticsFooter", () => {
  it("shows zero counts and opens logs from the global footer", () => {
    const html = renderToStaticMarkup(
      createElement(
        MantineProvider,
        { theme },
        createElement(DiagnosticsFooter, {
          graphLockDisabled: false,
          graphLocked: true,
          onOpenLogs: () => undefined,
          onToggleGraphLock: () => undefined,
          semanticDiagnostics: [],
          validation: { ok: true, value: graph() }
        })
      )
    );

    expect(html).toContain("aria-label=\"0 warnings\"");
    expect(html).toContain("aria-label=\"0 errors\"");
    expect(html).toContain("aria-label=\"Locked\"");
    expect(html).toContain("aria-label=\"Logs\"");
  });

  it("combines schema and semantic diagnostics into footer counts", () => {
    expect(
      diagnosticCounts(
        { errors: ["missing node"], ok: false },
        [
          diagnostic("warning", "implicit conversion"),
          diagnostic("error", "missing port")
        ]
      )
    ).toEqual({
      errors: 2,
      warnings: 1
    });
  });
});

function diagnostic(
  severity: GraphSemanticDiagnostic["severity"],
  message: string
): GraphSemanticDiagnostic {
  return {
    code: message,
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
