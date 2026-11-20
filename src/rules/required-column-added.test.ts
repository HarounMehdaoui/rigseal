import { describe, expect, it } from "vitest";
import type { AddColumn, Change } from "../types.ts";
import { requiredColumnAdded } from "./required-column-added.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model User {\n  id Int @id\n}\n";
const text = { name: "text", args: [], array: false };

function add(notNull: boolean, hasDefault: boolean, table = "User"): AddColumn {
  return {
    kind: "AddColumn",
    table,
    column: "phone",
    type: text,
    notNull,
    hasDefault,
    source: at(2),
  };
}

function judge(added: AddColumn, later: Change[] = []) {
  return requiredColumnAdded(added, contextFor(BASE, [added, ...later]));
}

describe("RG-DB-005 · required column added", () => {
  it("is UNSAFE for NOT NULL with no database default on a table base uses", () => {
    const entry = judge(add(true, false));
    expect(entry).toMatchObject({
      ruleId: "RG-DB-005",
      severity: "UNSAFE",
      target: "User.phone",
      source: at(2),
    });
    expect(entry.reason).toContain("NOT NULL violation");
    expect(entry.fix).toMatch(/nullable or with a default/);
  });

  it.each([
    ["nullable", add(false, false)],
    ["with a database default", add(true, true)],
    ["on a table base doesn't use", add(true, false, "Post")],
  ])("gives a SAFE note for a column added %s", (_why, added) => {
    expect(judge(added)).toMatchObject({
      ruleId: "RG-DB-005",
      severity: "SAFE",
      target: expect.any(String),
    });
  });

  it("is UNSAFE for the backfill hand-edit: ADD … DEFAULT '' then DROP DEFAULT (the lab's case)", () => {
    const entry = judge(add(true, true), [
      { kind: "DropDefault", table: "User", column: "phone", source: at(4) },
    ]);
    expect(entry).toMatchObject({ severity: "UNSAFE", source: at(2) });
  });

  it("is UNSAFE for ADD nullable, then SET NOT NULL later in the release", () => {
    const later: Change[] = [{ kind: "SetNotNull", table: "User", column: "phone", source: at(9) }];
    expect(judge(add(false, false), later).severity).toBe("UNSAFE");
  });

  it("gives a SAFE note when a later SET DEFAULT gives the column a database default", () => {
    const later: Change[] = [{ kind: "SetDefault", table: "User", column: "phone", source: at(4) }];
    expect(judge(add(true, false), later).severity).toBe("SAFE");
  });

  it("gives a SAFE note when the column is dropped again in the same release", () => {
    const later: Change[] = [{ kind: "DropColumn", table: "User", column: "phone", source: at(4) }];
    expect(judge(add(true, false), later).severity).toBe("SAFE");
  });
});
