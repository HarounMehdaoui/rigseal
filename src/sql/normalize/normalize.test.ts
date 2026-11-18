// Real Prisma output (fixtures/, from `prisma migrate diff --script`, Prisma 7.10.1) plus hand-written
// SQL for what Prisma never emits (RENAME, USING, CHECK, UPDATE, DELETE, other schemas).
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Change } from "../../types.ts";
import { parseSql, type Statement } from "../parse.ts";
import { normalize, normalizeStatement } from "./normalize.ts";
import { isSkipped } from "./skip-list.ts";

const MIGRATION = "20261117120000_test";

async function changes(sql: string): Promise<Change[]> {
  const result = await parseSql(sql);
  if (result.kind !== "parsed") throw new Error(`fixture doesn't parse: ${result.message}`);
  return normalize(MIGRATION, result.statements);
}

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}.sql`, import.meta.url), "utf8");
}

/** The change without its source, for tests that only care what it is. */
function what(change: Change | undefined): unknown {
  if (change === undefined) return undefined;
  const { source: _source, ...rest } = change;
  return rest;
}

const text = { name: "text", args: [], array: false };

describe("normalize: real Prisma output", () => {
  it("DROP TABLE → DropTable", async () => {
    expect((await changes(fixture("drop-table"))).map(what)).toEqual([
      { kind: "DropTable", table: "Post" },
    ]);
  });

  it("DROP COLUMN → DropColumn", async () => {
    expect((await changes(fixture("drop-column"))).map(what)).toEqual([
      { kind: "DropColumn", table: "User", column: "name" },
    ]);
  });

  it("splits Prisma's one-statement field rename into DropColumn + AddColumn, with action indexes", async () => {
    const result = await changes(fixture("rename-field"));
    expect(result).toEqual([
      {
        kind: "DropColumn",
        table: "User",
        column: "name",
        source: { kind: "statement", migration: MIGRATION, line: 3, action: 0 },
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "fullName",
        type: text,
        notNull: true,
        hasDefault: false,
        source: { kind: "statement", migration: MIGRATION, line: 3, action: 1 },
      },
    ]);
  });

  it("a model rename is DropTable + CreateTable (RULES §6 row 1)", async () => {
    expect((await changes(fixture("rename-model"))).map(what)).toEqual([
      { kind: "DropTable", table: "User" },
      { kind: "CreateTable", table: "Person" },
    ]);
  });

  it("ADD COLUMN records type, NOT NULL and whether the database fills a default", async () => {
    expect((await changes(fixture("add-columns"))).map(what)).toEqual([
      {
        kind: "AddColumn",
        table: "User",
        column: "createdAt",
        type: { name: "timestamp", args: ["3"], array: false },
        notNull: true,
        hasDefault: true,
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "nickname",
        type: text,
        notNull: false,
        hasDefault: false,
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "phone",
        type: text,
        notNull: true,
        hasDefault: false,
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "role",
        type: text,
        notNull: true,
        hasDefault: true,
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "seq",
        type: { name: "int4", args: [], array: false },
        notNull: true,
        hasDefault: true,
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "slug",
        type: text,
        notNull: true,
        hasDefault: true,
      },
      {
        kind: "AddColumn",
        table: "User",
        column: "tags",
        type: { name: "text", args: [], array: true },
        notNull: false,
        hasDefault: false,
      },
    ]);
  });

  it("SET DATA TYPE → AlterColumnType in Postgres's internal spelling", async () => {
    expect((await changes(fixture("type-change"))).map(what)).toEqual([
      {
        kind: "AlterColumnType",
        table: "User",
        column: "name",
        type: { name: "varchar", args: ["255"], array: false },
        using: false,
      },
      {
        kind: "AlterColumnType",
        table: "User",
        column: "age",
        type: { name: "int8", args: [], array: false },
        using: false,
      },
      {
        kind: "AlterColumnType",
        table: "User",
        column: "price",
        type: { name: "numeric", args: ["10", "2"], array: false },
        using: false,
      },
      {
        kind: "AlterColumnType",
        table: "User",
        column: "born",
        type: { name: "timestamptz", args: ["6"], array: false },
        using: false,
      },
    ]);
  });

  it("SET / DROP NOT NULL → SetNotNull, DropNotNull", async () => {
    expect((await changes(fixture("nullability"))).map(what)).toEqual([
      { kind: "SetNotNull", table: "User", column: "name" },
      { kind: "DropNotNull", table: "User", column: "email" },
    ]);
  });

  it("SET / DROP DEFAULT → SetDefault, DropDefault", async () => {
    expect((await changes(fixture("defaults"))).map(what)).toEqual([
      { kind: "SetDefault", table: "User", column: "role" },
      { kind: "DropDefault", table: "User", column: "plan" },
    ]);
  });

  it("CREATE TABLE → CreateTable on the line after its comment", async () => {
    const [created, ...rest] = await changes(fixture("create-table"));
    expect(created).toEqual({
      kind: "CreateTable",
      table: "Post",
      source: { kind: "statement", migration: MIGRATION, line: 3, action: 0 },
    });
    expect(rest.map(what)).toEqual([
      {
        kind: "AddConstraint",
        table: "Post",
        constraint: "foreignKey",
        name: "Post_authorId_fkey",
        columns: ["authorId"],
      },
    ]);
  });
});

describe("normalize: constraints, indexes and enums, real Prisma output", () => {
  it("@unique → CreateUniqueIndex with its columns", async () => {
    expect((await changes(fixture("add-unique"))).map(what)).toEqual([
      {
        kind: "CreateUniqueIndex",
        table: "User",
        name: "User_email_key",
        columns: ["email"],
        expressions: false,
      },
    ]);
  });

  it("@@index → CreateIndex", async () => {
    expect((await changes(fixture("add-index"))).map(what)).toEqual([
      { kind: "CreateIndex", table: "User", name: "User_name_idx" },
    ]);
  });

  it("removing @unique → DropIndex by name only", async () => {
    expect((await changes(fixture("drop-unique"))).map(what)).toEqual([
      { kind: "DropIndex", name: "User_email_key" },
    ]);
  });

  it("a new map: name → RenameIndex", async () => {
    expect((await changes(fixture("rename-index"))).map(what)).toEqual([
      { kind: "RenameIndex", name: "User_email_key", newName: "user_email_unique" },
    ]);
  });

  it("a primary- or foreign-key rename (RENAME CONSTRAINT) → RenameIndex (RULES §6 row 10)", async () => {
    expect((await changes(fixture("rename-constraints"))).map(what)).toEqual([
      { kind: "RenameIndex", name: "User_pkey", newName: "user_pk" },
      { kind: "RenameIndex", name: "Post_authorId_fkey", newName: "post_author_fk" },
    ]);
  });

  it("a new relation → AddConstraint foreignKey on the referencing columns", async () => {
    expect((await changes(fixture("add-foreign-key"))).map(what)).toEqual([
      {
        kind: "AddConstraint",
        table: "Post",
        constraint: "foreignKey",
        name: "Post_authorId_fkey",
        columns: ["authorId"],
      },
    ]);
  });

  it("removing a relation → DropConstraint", async () => {
    expect((await changes(fixture("drop-foreign-key"))).map(what)).toEqual([
      { kind: "DropConstraint", table: "Post", name: "Post_authorId_fkey" },
    ]);
  });

  it("a changed @@id → DropConstraint then AddConstraint primaryKey, actions 0 and 1", async () => {
    const result = await changes(fixture("change-primary-key"));
    expect(result.map((c) => [what(c), c.source.kind === "statement" && c.source.action])).toEqual([
      [{ kind: "DropConstraint", table: "Member", name: "Member_pkey" }, 0],
      [
        {
          kind: "AddConstraint",
          table: "Member",
          constraint: "primaryKey",
          name: "Member_pkey",
          columns: ["orgId", "userId"],
        },
        1,
      ],
    ]);
  });

  it("a new enum → CreateEnum, and its column's type is the enum", async () => {
    expect((await changes(fixture("create-enum"))).map(what)).toEqual([
      { kind: "CreateEnum", enum: "Role", values: ["ADMIN", "USER"] },
      {
        kind: "AddColumn",
        table: "User",
        column: "role",
        type: { name: "Role", args: [], array: false },
        notNull: true,
        hasDefault: true,
      },
    ]);
  });

  it("a new enum value → AddEnumValue", async () => {
    expect((await changes(fixture("add-enum-value"))).map(what)).toEqual([
      { kind: "AddEnumValue", enum: "Role", value: "GUEST" },
    ]);
  });

  it("removing an enum → DropColumn, then DropEnum", async () => {
    expect((await changes(fixture("drop-enum"))).map(what)).toEqual([
      { kind: "DropColumn", table: "User", column: "role" },
      { kind: "DropEnum", enum: "Role" },
    ]);
  });

  it("Prisma renames an enum (@@map) by recreating it, never with ALTER TYPE … RENAME", async () => {
    expect((await changes(fixture("rename-enum"))).map((c) => c.kind)).toEqual([
      "CreateEnum",
      "DropColumn",
      "AddColumn",
      "DropEnum",
    ]);
  });
});

describe("normalize: hand-written SQL", () => {
  it("RENAME COLUMN → RenameColumn", async () => {
    const sql = 'ALTER TABLE "User" RENAME COLUMN "name" TO "fullName";';
    expect((await changes(sql)).map(what)).toEqual([
      { kind: "RenameColumn", table: "User", column: "name", newName: "fullName" },
    ]);
  });

  it("RENAME TO → RenameTable", async () => {
    expect((await changes('ALTER TABLE "User" RENAME TO "Person";')).map(what)).toEqual([
      { kind: "RenameTable", table: "User", newName: "Person" },
    ]);
  });

  it("one DROP TABLE of two tables → two DropTable changes, actions 0 and 1", async () => {
    const result = await changes('DROP TABLE IF EXISTS "A", "public"."B" CASCADE;');
    expect(result.map((c) => [what(c), c.source.kind === "statement" && c.source.action])).toEqual([
      [{ kind: "DropTable", table: "A" }, 0],
      [{ kind: "DropTable", table: "B" }, 1],
    ]);
  });

  it("marks a USING cast on a type change", async () => {
    const sql = 'ALTER TABLE "User" ALTER COLUMN "age" TYPE INTEGER USING "age"::integer;';
    expect(what((await changes(sql))[0])).toEqual({
      kind: "AlterColumnType",
      table: "User",
      column: "age",
      type: { name: "int4", args: [], array: false },
      using: true,
    });
  });

  it("reads identity, PRIMARY KEY and explicit NULL on an added column", async () => {
    const sql =
      'ALTER TABLE "User" ADD COLUMN "n" INT GENERATED ALWAYS AS IDENTITY, ADD COLUMN "k" BIGINT PRIMARY KEY, ADD COLUMN "o" TEXT NULL;';
    expect(
      (await changes(sql)).map((c) =>
        c.kind === "AddColumn" ? [c.column, c.notNull, c.hasDefault] : c.kind,
      ),
    ).toEqual([
      ["n", true, true],
      ["k", true, false],
      ["o", false, false],
    ]);
  });

  it("treats the public schema like no schema, and any other schema as Unrecognized", async () => {
    const result = await changes(
      'ALTER TABLE "public"."User" DROP COLUMN "a";\nDROP TABLE "audit"."Event";',
    );
    expect(what(result[0])).toEqual({ kind: "DropColumn", table: "User", column: "a" });
    expect(result[1]).toMatchObject({
      kind: "Unrecognized",
      statement: "DropStmt",
      source: { line: 2, action: 0 },
    });
    expect(result[1]?.kind === "Unrecognized" && result[1].reason).toMatch(/audit/);
  });

  it("keeps an ALTER TABLE's known actions when one action is unknown", async () => {
    const sql = 'ALTER TABLE "User" DROP COLUMN "a", ENABLE ROW LEVEL SECURITY, DROP COLUMN "b";';
    expect(
      (await changes(sql)).map((c) => [c.kind, c.source.kind === "statement" && c.source.action]),
    ).toEqual([
      ["DropColumn", 0],
      ["Unrecognized", 1],
      ["DropColumn", 2],
    ]);
  });

  it("makes any other statement Unrecognized, named by its node kind", async () => {
    expect(await changes("CREATE VIEW v AS SELECT 1;")).toMatchObject([
      { kind: "Unrecognized", statement: "ViewStmt" },
    ]);
  });

  it("CHECK → AddConstraint check, its expression not analysed (RG-DB-013)", async () => {
    const sql = 'ALTER TABLE "User" ADD CONSTRAINT "age_ok" CHECK ("age" > 0) NOT VALID;';
    expect((await changes(sql)).map(what)).toEqual([
      { kind: "AddConstraint", table: "User", constraint: "check", name: "age_ok", columns: [] },
    ]);
  });

  it("UNIQUE constraint → AddConstraint unique with its columns", async () => {
    const sql = 'ALTER TABLE "User" ADD UNIQUE ("a", "b");';
    expect((await changes(sql)).map(what)).toEqual([
      {
        kind: "AddConstraint",
        table: "User",
        constraint: "unique",
        name: null,
        columns: ["a", "b"],
      },
    ]);
  });

  it("marks a unique index on an expression", async () => {
    const sql = 'CREATE UNIQUE INDEX "u" ON "public"."User" ("tenant", lower("email"));';
    expect((await changes(sql)).map(what)).toEqual([
      {
        kind: "CreateUniqueIndex",
        table: "User",
        name: "u",
        columns: ["tenant"],
        expressions: true,
      },
    ]);
  });

  it("ALTER TYPE … RENAME TO → RenameEnum", async () => {
    expect((await changes('ALTER TYPE "Role" RENAME TO "user_role";')).map(what)).toEqual([
      { kind: "RenameEnum", enum: "Role", newName: "user_role" },
    ]);
  });

  it("ALTER TYPE … RENAME VALUE is Unrecognized: base may still write the old value", async () => {
    expect(await changes("ALTER TYPE \"Role\" RENAME VALUE 'A' TO 'B';")).toMatchObject([
      { kind: "Unrecognized", statement: "AlterEnumStmt" },
    ]);
  });

  it("UPDATE → UpdateRows with the columns it sets", async () => {
    const sql = 'UPDATE "User" SET "fullName" = "name", "phone" = \'\' WHERE "id" > 0;';
    expect((await changes(sql)).map(what)).toEqual([
      { kind: "UpdateRows", table: "User", columns: ["fullName", "phone"] },
    ]);
  });

  it("DELETE and TRUNCATE → DeleteRows, one per truncated table", async () => {
    const sql = 'DELETE FROM "public"."Log" WHERE "old";\nTRUNCATE "A", "B";';
    expect(
      (await changes(sql)).map((c) => [what(c), c.source.kind === "statement" && c.source.action]),
    ).toEqual([
      [{ kind: "DeleteRows", table: "Log", via: "delete" }, 0],
      [{ kind: "DeleteRows", table: "A", via: "truncate" }, 0],
      [{ kind: "DeleteRows", table: "B", via: "truncate" }, 1],
    ]);
  });

  it("refuses enums and indexes outside the public schema", async () => {
    const sql = 'CREATE TYPE "audit"."Kind" AS ENUM (\'A\');\nDROP INDEX "audit"."i";';
    expect((await changes(sql)).map((c) => c.kind)).toEqual(["Unrecognized", "Unrecognized"]);
  });

  it("gives no change for skip-listed statements, and Unrecognized for a ROLLBACK", async () => {
    const sql = 'BEGIN;\nCREATE SCHEMA IF NOT EXISTS "public";\nCOMMIT;\nROLLBACK;';
    expect((await changes(sql)).map((c) => c.kind)).toEqual(["Unrecognized"]);
  });
});

describe("statement coverage (D28): every statement is skip-listed or gives at least one change", () => {
  const handWritten = [
    'ALTER TABLE "User" RENAME COLUMN "a" TO "b";',
    'ALTER TABLE "User" ADD CONSTRAINT "c" CHECK ("age" > 0), ENABLE ROW LEVEL SECURITY;',
    "ALTER TYPE \"Role\" RENAME VALUE 'A' TO 'B';",
    'UPDATE "User" SET "a" = 1;',
    'TRUNCATE "A";',
    'INSERT INTO "User" ("id") VALUES (1);',
    "CREATE VIEW v AS SELECT 1;",
    "CREATE FUNCTION f() RETURNS int LANGUAGE sql AS 'SELECT 1';",
    'BEGIN; CREATE SCHEMA IF NOT EXISTS "public"; COMMIT;',
  ];
  const fixtures = readdirSync(new URL("./fixtures/", import.meta.url)).map(fixture2);
  const lab = ["20261116120000_init", "20261116130000_fullname_phone"].map((m) =>
    readFileSync(
      new URL(`../../../lab/prisma/migrations/${m}/migration.sql`, import.meta.url),
      "utf8",
    ),
  );

  it.each([...fixtures, ...lab, ...handWritten])("%s", async (sql) => {
    const parsed = await parseSql(sql);
    if (parsed.kind !== "parsed") throw new Error(parsed.message);
    const perStatement = parsed.statements.map((statement: Statement) => ({
      skipped: isSkipped(statement.node),
      changes: normalizeStatement(MIGRATION, statement),
    }));
    for (const { skipped, changes: made } of perStatement) {
      expect(made.length > 0).toBe(!skipped);
    }
    expect(normalize(MIGRATION, parsed.statements)).toEqual(perStatement.flatMap((s) => s.changes));
  });
});

function fixture2(file: string): string {
  return readFileSync(new URL(`./fixtures/${file}`, import.meta.url), "utf8");
}
