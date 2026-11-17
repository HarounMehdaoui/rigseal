import { describe, expect, it } from "vitest";
import { describeChange } from "./describe-change.ts";
import type { Change, StatementSource } from "./types.ts";

const at: StatementSource = { kind: "statement", migration: "m", line: 1, action: 0 };
const varchar = { name: "varchar", args: ["255"], array: false };

describe("describeChange: one line per change kind", () => {
  it.each<[Change, string]>([
    [
      {
        kind: "EditedMigration",
        edit: "modified",
        source: { kind: "migration", migration: "1_a" },
      },
      "migration 1_a modified",
    ],
    [
      {
        kind: "Unparsable",
        message: "syntax error",
        line: 3,
        source: { kind: "migration", migration: "1_a" },
      },
      "migration 1_a does not parse",
    ],
    [{ kind: "CreateTable", table: "Post", source: at }, 'CREATE TABLE "Post"'],
    [{ kind: "DropTable", table: "Post", source: at }, 'DROP TABLE "Post"'],
    [
      { kind: "RenameTable", table: "User", newName: "Person", source: at },
      'RENAME TABLE "User" TO "Person"',
    ],
    [
      {
        kind: "AddColumn",
        table: "User",
        column: "phone",
        type: { name: "text", args: [], array: true },
        notNull: true,
        hasDefault: true,
        source: at,
      },
      'ADD COLUMN "User"."phone" text[] NOT NULL DEFAULT …',
    ],
    [
      { kind: "DropColumn", table: "User", column: "name", source: at },
      'DROP COLUMN "User"."name"',
    ],
    [
      { kind: "RenameColumn", table: "User", column: "name", newName: "fullName", source: at },
      'RENAME COLUMN "User"."name" TO "fullName"',
    ],
    [
      {
        kind: "AlterColumnType",
        table: "User",
        column: "name",
        type: varchar,
        using: true,
        source: at,
      },
      'ALTER COLUMN "User"."name" TYPE varchar(255) USING …',
    ],
    [{ kind: "SetNotNull", table: "User", column: "a", source: at }, 'SET NOT NULL "User"."a"'],
    [{ kind: "DropNotNull", table: "User", column: "a", source: at }, 'DROP NOT NULL "User"."a"'],
    [{ kind: "SetDefault", table: "User", column: "a", source: at }, 'SET DEFAULT "User"."a"'],
    [{ kind: "DropDefault", table: "User", column: "a", source: at }, 'DROP DEFAULT "User"."a"'],
    [
      { kind: "Unrecognized", statement: "ViewStmt", reason: "no normalizer", source: at },
      "unrecognized ViewStmt",
    ],
  ])("%j → %s", (change, line) => {
    expect(describeChange(change)).toBe(line);
  });
});
