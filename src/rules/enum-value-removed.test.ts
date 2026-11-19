import { describe, expect, it } from "vitest";
import type { RemoveEnumValue } from "../types.ts";
import { enumValueRemoved } from "./enum-value-removed.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE =
  "enum Role {\n  USER\n  GUEST\n}\nenum Kind {\n  A\n}\nmodel User {\n  id   Int  @id\n  role Role\n}\n";

function remove(enumName: string, value: string): RemoveEnumValue {
  return { kind: "RemoveEnumValue", enum: enumName, value, source: at(4) };
}

describe("RG-DB-016 · enum value removed", () => {
  it("is RISKY for a value of an enum base uses", () => {
    const entry = enumValueRemoved(remove("Role", "GUEST"), contextFor(BASE));
    expect(entry).toMatchObject({
      ruleId: "RG-DB-016",
      severity: "RISKY",
      target: "Role.GUEST",
      source: at(4),
    });
    expect(entry.reason).toContain("invalid input value for enum");
    expect(entry.fix).toMatch(/stop writing/i);
  });

  it("gives a SAFE note for an enum base doesn't use", () => {
    expect(enumValueRemoved(remove("Kind", "A"), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-016",
      severity: "SAFE",
    });
  });
});
