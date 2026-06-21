import { describe, expect, it } from "vitest";
import { finiteNumberFromDraft } from "./DeferredNumberInput";

describe("finiteNumberFromDraft", () => {
  it("accepts finite numbers and numeric strings", () => {
    expect(finiteNumberFromDraft(0.5)).toBe(0.5);
    expect(finiteNumberFromDraft("0.75")).toBe(0.75);
  });

  it("rejects empty, infinite, and non-numeric drafts", () => {
    expect(finiteNumberFromDraft("")).toBeNull();
    expect(finiteNumberFromDraft("  ")).toBeNull();
    expect(finiteNumberFromDraft("value")).toBeNull();
    expect(finiteNumberFromDraft(Number.NaN)).toBeNull();
    expect(finiteNumberFromDraft(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
