import { describe, expect, it } from "vitest";
import type { AddConstraint } from "../types.ts";
import { checkConstraint } from "./check-constraint.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model User {\n  id  Int @id\n  age Int\n}\n";

function check(table: string): AddConstraint {
  return {
    kind: "AddConstraint",
    table,
    constraint: "check",
    name: "age_ok",
    columns: [],
    source: at(2),
  };
}

describe("RG-DB-013 · new CHECK constraint", () => {
  it("is RISKY on a table base uses, whatever the expression", () => {
    const entry = checkConstraint(check("User"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-013", severity: "RISKY", target: "age_ok" });
    expect(entry.reason).toMatch(/violate the CHECK/);
    expect(entry.fix).toMatch(/NOT VALID/);
  });

  it("gives a SAFE note on a table base doesn't use", () => {
    expect(checkConstraint(check("Post"), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-013",
      severity: "SAFE",
    });
  });
});
