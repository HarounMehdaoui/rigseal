import { describe, expect, it } from "vitest";
import type { DropColumn } from "../types.ts";
import { dropColumn } from "./drop-column.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = `
  model User {
    id       Int     @id
    fullName String  @map("full_name")
    legacy   String? @ignore
  }
  model AuditLog {
    id   Int @id
    note String
    @@ignore
  }
`;

function drop(table: string, column: string): DropColumn {
  return { kind: "DropColumn", table, column, source: at(3) };
}

describe("RG-DB-002 · drop column", () => {
  it("is UNSAFE for a column base uses, under its @map name (fullName → full_name)", () => {
    const entry = dropColumn(drop("User", "full_name"), contextFor(BASE));
    expect(entry).toMatchObject({
      ruleId: "RG-DB-002",
      severity: "UNSAFE",
      target: "User.full_name",
      source: at(3),
    });
    expect(entry.reason).toContain("selects every scalar column");
    expect(entry.fix).toMatch(/@ignore/);
  });

  it("gives a SAFE note for the Prisma field name: it isn't a database column", () => {
    expect(dropColumn(drop("User", "fullName"), contextFor(BASE)).severity).toBe("SAFE");
  });

  it("gives a SAFE note, with its reason, for an @ignore'd column", () => {
    const entry = dropColumn(drop("User", "legacy"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-002", severity: "SAFE", target: "User.legacy" });
    expect(entry.reason).toMatch(/doesn't use column "User"\."legacy".*@ignore/);
    expect(entry.fix).toBeUndefined();
  });

  it("gives a SAFE note for a column of a table base doesn't use", () => {
    expect(dropColumn(drop("AuditLog", "note"), contextFor(BASE)).severity).toBe("SAFE");
  });
});
