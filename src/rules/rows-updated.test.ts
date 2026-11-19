import { describe, expect, it } from "vitest";
import type { UpdateRows } from "../types.ts";
import { rowsUpdated } from "./rows-updated.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model User {\n  id     Int     @id\n  name   String\n  legacy String? @ignore\n}\n";

function update(columns: string[], table = "User"): UpdateRows {
  return { kind: "UpdateRows", table, columns, source: at(5) };
}

describe("RG-DB-018 · rows updated", () => {
  it("is RISKY for an UPDATE that sets a column base uses", () => {
    const entry = rowsUpdated(update(["fullName", "name"]), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-018", severity: "RISKY", target: "User" });
    expect(entry.reason).toContain('"name"');
    expect(entry.fix).toMatch(/new column/);
  });

  it("gives a SAFE note for a backfill of a column added in this release (not in base's used set)", () => {
    const entry = rowsUpdated(update(["fullName"]), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-018", severity: "SAFE" });
    expect(entry.reason).toMatch(/backfill/);
  });

  it("gives a SAFE note for an UPDATE of only @ignore columns, or of a table base doesn't use", () => {
    expect(rowsUpdated(update(["legacy"]), contextFor(BASE)).severity).toBe("SAFE");
    expect(rowsUpdated(update(["name"], "Post"), contextFor(BASE)).severity).toBe("SAFE");
  });
});
