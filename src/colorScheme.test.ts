import { describe, expect, it } from "vitest";
import {
  normalizeColorScheme,
  readColorSchemeCookie
} from "./colorScheme";

describe("color scheme helpers", () => {
  it("normalizes supported Mantine color scheme values", () => {
    expect(normalizeColorScheme("light")).toBe("light");
    expect(normalizeColorScheme("dark")).toBe("dark");
    expect(normalizeColorScheme("auto")).toBe("auto");
    expect(normalizeColorScheme("weird")).toBeNull();
  });

  it("reads dsub-compatible color scheme cookie values", () => {
    expect(readColorSchemeCookie("mantine-color-scheme-value=dark")).toBe("dark");
    expect(readColorSchemeCookie("foo=bar; mantine-color-scheme-value=light")).toBe("light");
    expect(readColorSchemeCookie("foo=bar")).toBeNull();
  });
});
