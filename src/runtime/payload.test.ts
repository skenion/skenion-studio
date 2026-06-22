import { describe, expect, it } from "vitest";
import { validateProjectDocumentV01 } from "@skenion/contracts";
import { sampleGraph } from "../data/sampleGraph";
import { createProjectDocument, createViewStateFromPositions } from "../graph/projectDocument";
import { createRuntimeProjectPayload } from "./payload";
import type { RuntimeApiResponse } from "./types";

describe("runtime payload", () => {
  it("materializes the active current 0.1 project for Runtime API calls", () => {
    const activeProject = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const payload = createRuntimeProjectPayload(activeProject);

    expect(validateProjectDocumentV01(payload).ok).toBe(true);
    expect(payload).toEqual(activeProject);
    expect(payload).not.toBe(activeProject);
    expect(payload.graph).not.toBe(activeProject.graph);
    expect(payload.schemaVersion).toBe("0.1.0");
    expect(payload.graph.schemaVersion).toBe("0.1.0");
    expect(payload.graph.id).toBe(sampleGraph.id);
    expect(payload.graph.revision).toBe(sampleGraph.revision);
    expect(payload.graph.nodes.map((node) => node.id)).toEqual(sampleGraph.nodes.map((node) => node.id));
  });

  it("keeps current 0.1 payloads valid for Runtime API responses", () => {
    const activeProject = createProjectDocument(sampleGraph, createViewStateFromPositions(sampleGraph, {}));
    const payload = createRuntimeProjectPayload(activeProject);
    const response = {
      ok: true,
      diagnostics: [],
      plan: null,
      report: null
    } satisfies RuntimeApiResponse;

    expect(validateProjectDocumentV01(payload).ok).toBe(true);
    expect(payload.schemaVersion).toBe("0.1.0");
    expect(payload.graph.schemaVersion).toBe("0.1.0");
    expect(payload.patchLibrary).toEqual([]);
    expect(response.ok).toBe(true);
  });
});
