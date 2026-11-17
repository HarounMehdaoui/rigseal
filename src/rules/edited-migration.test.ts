import { describe, expect, it } from "vitest";
import type { EditedMigration } from "../types.ts";
import { editedMigration } from "./edited-migration.ts";

function change(edit: EditedMigration["edit"], migration: string): EditedMigration {
  return { kind: "EditedMigration", edit, source: { kind: "migration", migration } };
}

describe("RG-DB-020 · edited or removed migration", () => {
  it("gives a RISKY finding when a released migration was modified", () => {
    const finding = editedMigration(change("modified", "1_init"));
    expect(finding).toMatchObject({
      ruleId: "RG-DB-020",
      severity: "RISKY",
      target: "1_init",
      source: { kind: "migration", migration: "1_init" },
    });
    expect(finding.reason).toMatch(/edited/);
    expect(finding.fix).toMatch(/new migration/);
  });

  it("gives a RISKY finding when a released migration was removed", () => {
    const finding = editedMigration(change("removed", "2_phone"));
    expect(finding).toMatchObject({
      ruleId: "RG-DB-020",
      severity: "RISKY",
      target: "2_phone",
      source: { kind: "migration", migration: "2_phone" },
    });
    expect(finding.reason).toMatch(/removed/);
  });
});
