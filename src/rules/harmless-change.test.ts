import { describe, expect, it } from "vitest";
import { harmlessChange } from "./harmless-change.ts";
import { at } from "./rule-test-support.ts";

describe("RG-DB-000 · recognized, harmless, no rule (D40)", () => {
  it("gives SET DEFAULT a SAFE note: base's inserts still succeed", () => {
    const entry = harmlessChange({
      kind: "SetDefault",
      table: "User",
      column: "role",
      source: at(2),
    });
    expect(entry).toMatchObject({
      ruleId: "RG-DB-000",
      severity: "SAFE",
      target: "User.role",
      source: at(2),
    });
    expect(entry.reason).toMatch(/inserts still succeed/);
    expect(entry.fix).toBeUndefined();
  });
});
