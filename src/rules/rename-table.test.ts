import { describe, expect, it } from "vitest";
import type { RenameTable } from "../types.ts";
import { renameTable } from "./rename-table.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model User {\n  id Int @id\n}\n";

function rename(table: string, newName: string): RenameTable {
  return { kind: "RenameTable", table, newName, source: at(2) };
}

describe("RG-DB-003 · rename table", () => {
  it("is UNSAFE when base uses the old name", () => {
    const entry = renameTable(rename("User", "Person"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-003", severity: "UNSAFE", target: "User" });
    expect(entry.reason).toContain('"Person"');
    expect(entry.fix).toMatch(/@@map\("User"\)/);
  });

  it("gives a SAFE note when base doesn't use the old name", () => {
    const entry = renameTable(rename("Draft", "Post"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-003", severity: "SAFE", target: "Draft" });
    expect(entry.fix).toBeUndefined();
  });
});
