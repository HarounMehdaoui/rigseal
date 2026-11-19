import { describe, expect, it } from "vitest";
import type { AddConstraint } from "../types.ts";
import { foreignKey } from "./foreign-key.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model Post {\n  id       Int @id\n  authorId Int\n}\n";

function fk(table: string): AddConstraint {
  return {
    kind: "AddConstraint",
    table,
    constraint: "foreignKey",
    name: "Post_authorId_fkey",
    columns: ["authorId"],
    source: at(2),
  };
}

describe("RG-DB-014 · new foreign key", () => {
  it("is RISKY on a table base uses", () => {
    const entry = foreignKey(fk("Post"), contextFor(BASE));
    expect(entry).toMatchObject({
      ruleId: "RG-DB-014",
      severity: "RISKY",
      target: "Post_authorId_fkey",
    });
    expect(entry.reason).toMatch(/missing parent/);
    expect(entry.fix).toMatch(/relation/);
  });

  it("gives a SAFE note on a table base doesn't use (e.g. created in this release)", () => {
    expect(foreignKey(fk("Comment"), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-014",
      severity: "SAFE",
    });
  });
});
