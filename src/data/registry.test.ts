import { builtinNodeDefinitionsV01 } from "@skenion/contracts";
import { describe, expect, it } from "vitest";
import { CLEAR_COLOR_NODE_KIND } from "../graph/clearColor";
import { COLOR_NODE_KIND } from "../graph/colorRgba";
import { FULLSCREEN_SHADER_NODE_KIND, defaultFullscreenShaderParams } from "../graph/fullscreenShader";
import { createGraphNodeFromDefinition } from "../graph/skenionGraph";
import { nodeRegistry } from "./registry";
import {
  renderSampleGraph,
  objectRoutingPanelSampleGraph,
  objectVisualSampleGraph,
  shaderMultiUniformSampleGraph,
  shaderUniformSampleGraph
} from "./sampleGraph";

describe("node registry", () => {
  it("uses the contracts builtin node ids as the registry source", () => {
    expect(nodeRegistry.map((definition) => definition.id)).toEqual(
      builtinNodeDefinitionsV01.map((definition) => definition.id)
    );
  });

  it("matches canonical contracts builtins for render definitions", () => {
    expect(findStudioDefinition(FULLSCREEN_SHADER_NODE_KIND)?.ports).toEqual(
      findContractsDefinition(FULLSCREEN_SHADER_NODE_KIND)?.ports
    );
    expect(findStudioDefinition("render.output")?.ports).toEqual(
      findContractsDefinition("render.output")?.ports
    );
    expect(findStudioDefinition(CLEAR_COLOR_NODE_KIND)?.ports).toEqual(
      findContractsDefinition(CLEAR_COLOR_NODE_KIND)?.ports
    );
    expect(findStudioDefinition(COLOR_NODE_KIND)?.ports).toEqual(
      findContractsDefinition(COLOR_NODE_KIND)?.ports
    );
  });

  it("does not expose non-canonical f32 dataKind values", () => {
    expect(findDataKinds(nodeRegistry)).not.toContain("f32");
    expect(shaderUniformSampleGraph.nodes.find((node) => node.id === "shader_1")?.ports.find((port) => port.id === "speed")?.type).toMatchObject({
      flow: "value",
      dataKind: "number.float"
    });
  });

  it("exposes typed value node control ports", () => {
    expect(findStudioDefinition("core.float")?.ports.map((port) => port.id)).toEqual([
      "in",
      "cold",
      "value"
    ]);
    expect(findStudioDefinition("core.int")?.ports.map((port) => port.id)).toEqual([
      "in",
      "cold",
      "value"
    ]);
    expect(findStudioDefinition("core.bool")?.ports.map((port) => port.id)).toEqual([
      "in",
      "cold",
      "value"
    ]);
    expect(findStudioDefinition(COLOR_NODE_KIND)?.ports.map((port) => port.id)).toEqual([
      "in",
      "cold",
      "value"
    ]);
    expect(findStudioDefinition("core.string")?.ports.map((port) => port.id)).toEqual([
      "in",
      "cold",
      "value"
    ]);
    expect(findStudioDefinition("core.message")?.ports.map((port) => port.id)).toEqual([
      "in",
      "out"
    ]);
    expect(findStudioDefinition("core.bang")?.ports.map((port) => port.id)).toEqual(["in", "out"]);
    expect(findStudioDefinition("core.comment")?.ports.map((port) => port.id)).toEqual([]);
    expect(nodeRegistry.map((definition) => definition.id)).not.toEqual(
      expect.arrayContaining([
        removedKind("core", "target"),
        removedKind("core", "bang-button"),
        removedKind("core", "event-log"),
        removedKind("core", "toggle"),
        removedKind("ui", "button"),
        removedKind("ui", "slider-float"),
        removedKind("ui", "slider-f32"),
        removedKind("ui", "toggle")
      ])
    );
  });

  it("creates fullscreen shader nodes with Studio default wgsl params", () => {
    const definition = findStudioDefinition(FULLSCREEN_SHADER_NODE_KIND);
    const node = createGraphNodeFromDefinition(definition!, []);

    expect(node.params).toEqual(defaultFullscreenShaderParams());
    expect(node.ports.map((port) => port.id)).toEqual(["out"]);
    expect(String(node.params.source)).toContain("@skenion.uniform speed");
    expect(String(node.params.source)).not.toContain("fn vs_main");
    expect(String(node.params.source)).toContain("fn fs_main");
  });

  it("creates sample graphs with canonical shader uniform ports", () => {
    const valuePort = shaderUniformSampleGraph.nodes
      .find((node) => node.id === "value_1")
      ?.ports.find((port) => port.id === "value");
    const uniformPort = shaderUniformSampleGraph.nodes
      .find((node) => node.id === "shader_1")
      ?.ports.find((port) => port.id === "speed");
    const secondUniformPort = shaderMultiUniformSampleGraph.nodes
      .find((node) => node.id === "shader_1")
      ?.ports.find((port) => port.id === "phase");
    const colorPort = shaderMultiUniformSampleGraph.nodes
      .find((node) => node.id === "color_1")
      ?.ports.find((port) => port.id === "value");
    const colorUniformPort = shaderMultiUniformSampleGraph.nodes
      .find((node) => node.id === "shader_1")
      ?.ports.find((port) => port.id === "tint");

    expect(valuePort?.type.dataKind).toBe("number.float");
    expect(uniformPort?.type.dataKind).toBe("number.float");
    expect(secondUniformPort?.type.dataKind).toBe("number.float");
    expect(colorPort?.type.dataKind).toBe("color");
    expect(colorUniformPort?.type.dataKind).toBe("color");
    expect(
      findDataKinds([
        renderSampleGraph,
        shaderUniformSampleGraph,
        shaderMultiUniformSampleGraph,
        objectRoutingPanelSampleGraph,
        objectVisualSampleGraph
      ])
    ).not.toContain("f32");
  });
});

function findStudioDefinition(id: string) {
  return nodeRegistry.find((candidate) => candidate.id === id);
}

function findContractsDefinition(id: string) {
  return builtinNodeDefinitionsV01.find((candidate) => candidate.id === id);
}

function removedKind(scope: string, name: string) {
  return `${scope}.${name}`;
}

function findDataKinds(value: unknown): string[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(findDataKinds);
  }

  const record = value as Record<string, unknown>;
  const current = typeof record.dataKind === "string" ? [record.dataKind] : [];
  return [...current, ...Object.values(record).flatMap(findDataKinds)];
}
