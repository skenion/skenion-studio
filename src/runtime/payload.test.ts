import { describe, expect, it } from "vitest";
import { validateProjectDocumentV02 } from "@skenion/contracts";
import { sampleGraph } from "../data/sampleGraph";
import { createProjectDocument, createViewStateFromPositions, parseGraphDocumentAsActiveProject } from "../graph/projectDocument";
import minimalValueProject from "../../.deps/skenion-examples/compatibility/v0.1/projects/valid/minimal-value.project.json";
import { createRuntimeProjectPayload } from "./payload";
import type { RuntimeApiResponse } from "./types";

describe("runtime payload", () => {
  it("materializes the active v0.2 project for Runtime API calls", () => {
    const activeProject = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const payload = createRuntimeProjectPayload(activeProject);

    expect(validateProjectDocumentV02(payload).ok).toBe(true);
    expect(payload).toEqual(activeProject);
    expect(payload).not.toBe(activeProject);
    expect(payload.graph).not.toBe(activeProject.graph);
    expect(payload.schemaVersion).toBe("0.2.0");
    expect(payload.graph.schemaVersion).toBe("0.2.0");
    expect(payload.graph.id).toBe(sampleGraph.id);
    expect(payload.graph.revision).toBe(sampleGraph.revision);
    expect(payload.graph.nodes.map((node) => node.id)).toEqual(sampleGraph.nodes.map((node) => node.id));
  });

  it("migrates legacy examples before creating runtime payloads", () => {
    const activeProject = parseGraphDocumentAsActiveProject(minimalValueProject.graph);
    const payload = createRuntimeProjectPayload(activeProject);
    const response = {
      ok: true,
      diagnostics: [],
      plan: null,
      report: null
    } satisfies RuntimeApiResponse;

    expect(validateProjectDocumentV02(payload).ok).toBe(true);
    expect(payload.schemaVersion).toBe("0.2.0");
    expect(payload.graph.schemaVersion).toBe("0.2.0");
    expect(payload.patchLibrary).toEqual([]);
    expect(response.ok).toBe(true);
  });
});
