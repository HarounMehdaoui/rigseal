import { describe, expect, it } from "vitest";
import { exitCode, type FailOn } from "./exit-code.ts";
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

describe("findings → verdict → exit code (D2, D14)", () => {
  it.each<[Severity[], FailOn, Severity, 0 | 1]>([
    [[], "unsafe", "SAFE", 0],
    [["SAFE", "SAFE"], "unsafe", "SAFE", 0],
    [["SAFE", "RISKY"], "unsafe", "RISKY", 0],
    [["RISKY", "UNSAFE", "SAFE"], "unsafe", "UNSAFE", 1],
    [[], "risky", "SAFE", 0],
    [["SAFE"], "risky", "SAFE", 0],
    [["SAFE", "RISKY"], "risky", "RISKY", 1],
    [["UNSAFE"], "risky", "UNSAFE", 1],
  ])("%j with --fail-on %s → %s → exit %i", (severities, failOn, verdict, code) => {
    const v = verdictOf(severities.map(entry));
    expect(v).toBe(verdict);
    expect(exitCode(v, failOn)).toBe(code);
  });
});
