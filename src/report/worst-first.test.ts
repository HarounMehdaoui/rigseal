import { describe, expect, it } from "vitest";
import type { ReportEntry } from "./types.ts";
import { worstFirst } from "./worst-first.ts";

function entry(severity: ReportEntry["severity"], target: string): ReportEntry {
  return { ruleId: "R", severity, target, file: "f", line: 1, action: 0, reason: "r" };
}

describe("worstFirst", () => {
  it("puts UNSAFE before RISKY, keeps SAFE notes apart, and keeps JSON order within each group", () => {
    const entries = [
      entry("RISKY", "r1"),
      entry("SAFE", "s1"),
      entry("UNSAFE", "u1"),
      entry("RISKY", "r2"),
      entry("SAFE", "s2"),
      entry("UNSAFE", "u2"),
    ];
    const { findings, notes } = worstFirst(entries);
    expect(findings.map((e) => e.target)).toEqual(["u1", "u2", "r1", "r2"]);
    expect(notes.map((e) => e.target)).toEqual(["s1", "s2"]);
  });
});
