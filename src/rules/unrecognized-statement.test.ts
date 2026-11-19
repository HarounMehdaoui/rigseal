import { describe, expect, it } from "vitest";
import { migrationChanges } from "../sql/migration-changes.ts";
import { unrecognizedStatement } from "./unrecognized-statement.ts";

describe("RG-DB-022 · unrecognized statement", () => {
  it("is RISKY for CREATE EXTENSION, quoting what it is and why it isn't modelled", async () => {
    const [change] = await migrationChanges("3_ext", 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    if (change?.kind !== "Unrecognized") throw new Error("expected Unrecognized");
    const entry = unrecognizedStatement(change);
    expect(entry).toMatchObject({
      ruleId: "RG-DB-022",
      severity: "RISKY",
      target: "CreateExtensionStmt",
      source: { kind: "statement", migration: "3_ext", line: 1, action: 0 },
    });
    expect(entry.reason).toMatch(/doesn't model/);
    expect(entry.reason).toMatch(/no normalizer/);
    expect(entry.fix).toMatch(/by hand/);
  });

  it("is RISKY even for a statement outside the public schema", async () => {
    const [change] = await migrationChanges("4_audit", 'DROP TABLE "audit"."Event";');
    if (change?.kind !== "Unrecognized") throw new Error("expected Unrecognized");
    expect(unrecognizedStatement(change)).toMatchObject({ severity: "RISKY", target: "DropStmt" });
  });
});
