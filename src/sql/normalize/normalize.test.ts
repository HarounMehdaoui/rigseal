// Real Prisma output (fixtures/, from `prisma migrate diff --script`, Prisma 7.10.1) plus hand-written
// SQL for what Prisma never emits (RENAME, USING, other schemas).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Change } from "../../types.ts";
import { parseSql } from "../parse.ts";
import { normalize } from "./normalize.ts";

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
    // The foreign key that follows is T3.3's AddConstraint; until then it is Unrecognized.
    expect(rest).toHaveLength(1);
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
});
