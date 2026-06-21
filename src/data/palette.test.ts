import { describe, expect, it } from "vitest";
import { nodeRegistry } from "./registry";
import { paletteDirectDefinitions } from "./palette";

describe("palette direct definitions", () => {
  it("shows only definitions with explicit palette surface", () => {
    const directIds = paletteDirectDefinitions(nodeRegistry).map((definition) => definition.id);

    expect(nodeRegistry.find((definition) => definition.id === "core.float")?.surface?.palette).toBe("direct");
    expect(nodeRegistry.find((definition) => definition.id === "core.operator.add")?.surface?.palette).toBeUndefined();
    expect(nodeRegistry.find((definition) => definition.id === "audio.operator.mul")?.surface?.palette).toBeUndefined();
    expect(directIds).not.toContain("core.operator.add");
    expect(directIds).not.toContain("audio.operator.mul");
    expect(directIds).toContain("core.float");
    expect(directIds).toContain("audio.osc");
  });
});
