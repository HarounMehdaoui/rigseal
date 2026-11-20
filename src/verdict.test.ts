import { describe, expect, it } from "vitest";
import type { Entry, Severity } from "./types.ts";
import { verdictOf } from "./verdict.ts";

function entry(severity: Severity): Entry {
  return {
    ruleId: "RG-DB-000",
    severity,
    target: "t",
    reason: "r",
    source: { kind: "migration", migration: "m" },
  };
}

describe("verdictOf (worst entry wins)", () => {
  it("is SAFE with no entries at all (a release with no SQL)", () => {
    expect(verdictOf([])).toBe("SAFE");
  });

  it("is SAFE when every entry is a SAFE note", () => {
    expect(verdictOf([entry("SAFE"), entry("SAFE")])).toBe("SAFE");
  });

  it("is RISKY when the worst entry is RISKY", () => {
    expect(verdictOf([entry("SAFE"), entry("RISKY"), entry("SAFE")])).toBe("RISKY");
  });

  it("is UNSAFE when any entry is UNSAFE, wherever it is", () => {
    expect(verdictOf([entry("UNSAFE"), entry("RISKY")])).toBe("UNSAFE");
    expect(verdictOf([entry("RISKY"), entry("SAFE"), entry("UNSAFE")])).toBe("UNSAFE");
  });
});
