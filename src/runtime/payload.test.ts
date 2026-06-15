import { describe, expect, it } from "vitest";
import { nodeRegistry } from "../data/registry";
import { sampleGraph } from "../data/sampleGraph";
import minimalValueProject from "../../.deps/skenion-examples/compatibility/v0.1/projects/valid/minimal-value.project.json";
import { createRuntimeProjectPayload } from "./payload";
import type { RuntimeApiResponse, RuntimeProjectPayload } from "./types";

describe("runtime payload", () => {
  it("packages the current graph and node registry for Runtime API calls", () => {
    const payload = createRuntimeProjectPayload(sampleGraph, nodeRegistry);

    expect(payload.graph).toBe(sampleGraph);
    expect(payload.nodes).toBe(nodeRegistry);
    expect(payload.nodes.length).toBeGreaterThan(0);
    expect(payload.graph.schema).toBe("skenion.graph");
    expect(payload.graph.schemaVersion).toBe("0.1.0");
    expect(payload.nodes.every((node) => node.schema === "skenion.node.definition")).toBe(true);
    expect(payload.nodes.every((node) => node.schemaVersion === "0.1.0")).toBe(true);
  });

  it("accepts the examples minimal project payload shape and runtime response envelope", () => {
    const payload = minimalValueProject as RuntimeProjectPayload;
    const response = {
      ok: true,
      diagnostics: [],
      plan: null,
      report: null
    } satisfies RuntimeApiResponse;

    expect(payload.graph.schema).toBe("skenion.graph");
    expect(payload.graph.schemaVersion).toBe("0.1.0");
    expect(payload.nodes.length).toBeGreaterThan(0);
    expect(payload.nodes.every((node) => node.schema === "skenion.node.definition")).toBe(true);
    expect(response.ok).toBe(true);
  });
});
