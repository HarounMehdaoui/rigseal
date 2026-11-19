import { describe, expect, it } from "vitest";
import type { AddColumn, Change, SetNotNull } from "../types.ts";
import { at, contextFor } from "./rule-test-support.ts";
import { setNotNull } from "./set-not-null.ts";

const BASE = "model User {\n  id       Int     @id\n  nickname String?\n  email    String\n}\n";

function judge(column: string, before: Change[] = []) {
  const change: SetNotNull = { kind: "SetNotNull", table: "User", column, source: at(5) };
  return setNotNull(change, contextFor(BASE, [...before, change]));
}

describe("RG-DB-009 · set NOT NULL", () => {
  it("is RISKY on a column base has as optional", () => {
    const entry = judge("nickname");
    expect(entry).toMatchObject({
      ruleId: "RG-DB-009",
      severity: "RISKY",
      target: "User.nickname",
    });
    expect(entry.reason).toContain("NOT NULL violation");
    expect(entry.fix).toMatch(/always writes/);
  });

  it("gives a SAFE note when base's field is already required", () => {
    const entry = judge("email");
    expect(entry).toMatchObject({ ruleId: "RG-DB-009", severity: "SAFE" });
    expect(entry.reason).toMatch(/required/);
  });

  it("gives a SAFE note for a column added in this release: RG-DB-005 judges its end state", () => {
    const added: AddColumn = {
      kind: "AddColumn",
      table: "User",
      column: "phone",
      type: { name: "text", args: [], array: false },
      notNull: false,
      hasDefault: false,
      source: at(2),
    };
    const entry = judge("phone", [added]);
    expect(entry).toMatchObject({ ruleId: "RG-DB-009", severity: "SAFE" });
    expect(entry.reason).toMatch(/RG-DB-005/);
  });

  it("gives a SAFE note for a column base doesn't use", () => {
    expect(judge("legacy").severity).toBe("SAFE");
  });
});
