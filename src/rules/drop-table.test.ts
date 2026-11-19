import { describe, expect, it } from "vitest";
import type { DropTable } from "../types.ts";
import { dropTable } from "./drop-table.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = `
  model User {
    id Int @id
    @@map("users")
  }
  model AuditLog {
    id Int @id
    @@ignore
  }
`;

function drop(table: string): DropTable {
  return { kind: "DropTable", table, source: at(2) };
}

describe("RG-DB-001 · drop table", () => {
  it("is UNSAFE for a table base uses, named by its database name (@@map)", () => {
    const entry = dropTable(drop("users"), contextFor(BASE));
    expect(entry).toMatchObject({
      ruleId: "RG-DB-001",
      severity: "UNSAFE",
      target: "users",
      source: at(2),
    });
    expect(entry.reason).toContain("relation does not exist");
    expect(entry.fix).toMatch(/@@ignore/);
  });

  it("gives a SAFE note for an @@ignore model's table", () => {
    const entry = dropTable(drop("AuditLog"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-001", severity: "SAFE", target: "AuditLog" });
    expect(entry.reason).toMatch(/doesn't use/);
    expect(entry.fix).toBeUndefined();
  });

  it("gives a SAFE note for a table base doesn't know (the model name, not the table)", () => {
    expect(dropTable(drop("User"), contextFor(BASE)).severity).toBe("SAFE");
  });
});
