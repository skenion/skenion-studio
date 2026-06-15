import { describe, expect, it } from "vitest";
import { nodeRegistry } from "../data/registry";
import { sampleGraph } from "../data/sampleGraph";
import { createRuntimeProjectPayload } from "./payload";

describe("runtime payload", () => {
  it("packages the current graph and node registry for Runtime API calls", () => {
    const payload = createRuntimeProjectPayload(sampleGraph, nodeRegistry);

    expect(payload.graph).toBe(sampleGraph);
    expect(payload.nodes).toBe(nodeRegistry);
    expect(payload.nodes.length).toBeGreaterThan(0);
  });
});
