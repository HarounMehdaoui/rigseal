import { describe, expect, it } from "vitest";
import type { AddConstraint, CreateUniqueIndex } from "../types.ts";
import { at, contextFor } from "./rule-test-support.ts";
import { uniqueConstraint } from "./unique-constraint.ts";

const BASE = "model User {\n  id    Int    @id\n  email String\n}\n";

function index(columns: string[], expressions = false, table = "User"): CreateUniqueIndex {
  return { kind: "CreateUniqueIndex", table, name: "u", columns, expressions, source: at(2) };
}

describe("RG-DB-012 · new unique constraint or primary key", () => {
  it("is RISKY for a unique index on a column base uses", () => {
    const entry = uniqueConstraint(index(["email"]), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-012", severity: "RISKY", target: "u" });
    expect(entry.reason).toContain("unique violation");
    expect(entry.fix).toMatch(/@unique/);
  });

  it("is RISKY for ADD PRIMARY KEY / UNIQUE on a used column", () => {
    const pk: AddConstraint = {
      kind: "AddConstraint",
      table: "User",
      constraint: "primaryKey",
      name: null,
      columns: ["id", "email"],
      source: at(2),
    };
    expect(uniqueConstraint(pk, contextFor(BASE))).toMatchObject({
      severity: "RISKY",
      target: "User",
    });
  });

  it("is RISKY when part of the key is an expression on a used table (it can't tell which columns)", () => {
    expect(uniqueConstraint(index([], true), contextFor(BASE)).severity).toBe("RISKY");
  });

  it("gives a SAFE note when no constrained column is used by base", () => {
    expect(uniqueConstraint(index(["nickname"]), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-012",
      severity: "SAFE",
    });
    expect(uniqueConstraint(index(["email"], false, "Post"), contextFor(BASE)).severity).toBe(
      "SAFE",
    );
  });
});
