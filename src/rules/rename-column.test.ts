import { describe, expect, it } from "vitest";
import type { RenameColumn } from "../types.ts";
import { renameColumn } from "./rename-column.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = 'model User {\n  id   Int    @id\n  name String @map("full_name")\n}\n';

function rename(column: string, newName: string): RenameColumn {
  return { kind: "RenameColumn", table: "User", column, newName, source: at(2) };
}

describe("RG-DB-004 · rename column", () => {
  it("is UNSAFE when base uses the old column (its @map name)", () => {
    const entry = renameColumn(rename("full_name", "display_name"), contextFor(BASE));
    expect(entry).toMatchObject({
      ruleId: "RG-DB-004",
      severity: "UNSAFE",
      target: "User.full_name",
    });
    expect(entry.reason).toContain("selects");
    expect(entry.fix).toMatch(/@map\("full_name"\)/);
  });

  it("gives a SAFE note when base doesn't use the old column", () => {
    const entry = renameColumn(rename("name", "fullName"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-004", severity: "SAFE", target: "User.name" });
  });
});
