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
      {
        kind: "AddConstraint",
        table: "Post",
        constraint: "foreignKey",
        name: "Post_authorId_fkey",
        columns: ["authorId"],
        source: at,
      },
      'ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ON "Post" ("authorId")',
    ],
    [
      {
        kind: "AddConstraint",
        table: "T",
        constraint: "check",
        name: null,
        columns: [],
        source: at,
      },
      'ADD CONSTRAINT CHECK ON "T"',
    ],
    [
      { kind: "DropConstraint", table: "Post", name: "Post_pkey", source: at },
      'DROP CONSTRAINT "Post_pkey" ON "Post"',
    ],
    [
      {
        kind: "CreateUniqueIndex",
        table: "User",
        name: "User_email_key",
        columns: ["email"],
        expressions: true,
        source: at,
      },
      'CREATE UNIQUE INDEX "User_email_key" ON "User" ("email", …)',
    ],
    [{ kind: "CreateIndex", table: "User", name: null, source: at }, 'CREATE INDEX ON "User"'],
    [{ kind: "DropIndex", name: "User_email_key", source: at }, 'DROP INDEX "User_email_key"'],
    [{ kind: "RenameIndex", name: "a", newName: "b", source: at }, 'RENAME INDEX "a" TO "b"'],
    [
      { kind: "CreateEnum", enum: "Role", values: ["A", "B"], source: at },
      "CREATE ENUM \"Role\" ('A', 'B')",
    ],
    [{ kind: "DropEnum", enum: "Role", source: at }, 'DROP ENUM "Role"'],
    [
      { kind: "AddEnumValue", enum: "Role", value: "GUEST", source: at },
      "ADD VALUE 'GUEST' TO ENUM \"Role\"",
    ],
    [
      { kind: "RenameEnum", enum: "Role", newName: "user_role", source: at },
      'RENAME ENUM "Role" TO "user_role"',
    ],
    [
      { kind: "UpdateRows", table: "User", columns: ["a", "b"], source: at },
      'UPDATE "User" SET "a", "b"',
    ],
    [{ kind: "DeleteRows", table: "Log", via: "delete", source: at }, 'DELETE FROM "Log"'],
    [{ kind: "DeleteRows", table: "Log", via: "truncate", source: at }, 'TRUNCATE "Log"'],
    [
      { kind: "Unrecognized", statement: "ViewStmt", reason: "no normalizer", source: at },
      "unrecognized ViewStmt",
    ],
  ])("%j → %s", (change, line) => {
    expect(describeChange(change)).toBe(line);
  });
});
