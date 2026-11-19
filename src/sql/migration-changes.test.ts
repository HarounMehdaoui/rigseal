import { describe, expect, it } from "vitest";
import { migrationChanges } from "./migration-changes.ts";

describe("migrationChanges", () => {
  it("normalizes a migration Postgres accepts", async () => {
    const changes = await migrationChanges(
      "2_drop",
      '-- AlterTable\nALTER TABLE "User" DROP COLUMN "name";\n',
    );
    expect(changes).toEqual([
      {
        kind: "DropColumn",
        table: "User",
        column: "name",
        source: { kind: "statement", migration: "2_drop", line: 2, action: 0 },
      },
    ]);
  });

  it("gives one Unparsable change, for the whole migration, when Postgres rejects it", async () => {
    const changes = await migrationChanges("3_broken", 'SELECT 1;\nALTER TABLE "User" DROP;\n');
    expect(changes).toEqual([
      {
        kind: "Unparsable",
        message: 'syntax error at or near ";"',
        line: 2,
        source: { kind: "migration", migration: "3_broken" },
      },
    ]);
  });

  it("gives no changes for a migration of comments only", async () => {
    expect(await migrationChanges("4_empty", "-- This is an empty migration.\n")).toEqual([]);
  });
});
