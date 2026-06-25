import { describe, expect, it } from "vitest";
import {
  hasUnresolvedVariables,
  resolveOptionalPositiveInt,
  resolvePositiveInt,
} from "./timerFields";

describe("hasUnresolvedVariables", () => {
  it("detects unresolved placeholders", () => {
    expect(hasUnresolvedVariables("{{missing}}")).toBe(true);
    expect(hasUnresolvedVariables("1000")).toBe(false);
  });
});

describe("resolvePositiveInt", () => {
  it("substitutes variables before parsing", () => {
    const result = resolvePositiveInt("{{delay}}", { delay: "2000" });
    expect(result).toEqual({ value: 2000 });
  });

  it("rejects unresolved variables", () => {
    const result = resolvePositiveInt("{{missing}}", {});
    expect(result.error).toBe("Unresolved variable placeholder");
  });

  it("rejects non-positive integers", () => {
    expect(resolvePositiveInt("0", {}).error).toBe(
      "Must be a positive integer"
    );
    expect(resolvePositiveInt("1.5", {}).error).toBe(
      "Must be a positive integer"
    );
    expect(resolvePositiveInt("", {}).error).toBe("Value is required");
  });
});

describe("resolveOptionalPositiveInt", () => {
  it("allows empty values for unlimited sends", () => {
    expect(resolveOptionalPositiveInt("", {})).toEqual({ value: undefined });
  });

  it("validates non-empty values like required fields", () => {
    expect(resolveOptionalPositiveInt("3", {})).toEqual({ value: 3 });
    expect(resolveOptionalPositiveInt("{{n}}", { n: "2" })).toEqual({
      value: 2,
    });
  });
});
