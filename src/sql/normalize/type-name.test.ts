import { describe, expect, it } from "vitest";
import { parseSql, type TypeName } from "../parse.ts";
import { pgType } from "./type-name.ts";

/** The TypeName libpg-query produces for `ALTER COLUMN x TYPE <type>`. */
async function typeName(type: string): Promise<TypeName> {
  const result = await parseSql(`ALTER TABLE t ALTER COLUMN x TYPE ${type};`);
  if (result.kind !== "parsed") throw new Error(result.message);
  const node = result.statements[0]?.node;
  const cmd = node && "AlterTableStmt" in node ? node.AlterTableStmt.cmds?.[0] : undefined;
  const def = cmd && "AlterTableCmd" in cmd ? cmd.AlterTableCmd.def : undefined;
  const found = def && "ColumnDef" in def ? def.ColumnDef.typeName : undefined;
  if (found === undefined) throw new Error(`no TypeName for ${type}`);
  return found;
}

describe("pgType", () => {
  it.each([
    ["INTEGER", "int4", []],
    ["BIGINT", "int8", []],
    ["SMALLINT", "int2", []],
    ["DOUBLE PRECISION", "float8", []],
    ["REAL", "float4", []],
    ["BOOLEAN", "bool", []],
    ["TEXT", "text", []],
    ["VARCHAR(255)", "varchar", ["255"]],
    ["DECIMAL(65,30)", "numeric", ["65", "30"]],
    ["TIMESTAMP(3)", "timestamp", ["3"]],
    ["TIMESTAMPTZ(6)", "timestamptz", ["6"]],
    ["JSONB", "jsonb", []],
    ["BYTEA", "bytea", []],
  ])("%s → %s %j", async (sql, name, args) => {
    expect(pgType(await typeName(sql))).toEqual({ name, args, array: false });
  });

  it("reads a zero argument, which the parser leaves out of its output", async () => {
    expect(pgType(await typeName("TIMESTAMP(0)"))).toEqual({
      name: "timestamp",
      args: ["0"],
      array: false,
    });
  });

  it("marks arrays", async () => {
    expect(pgType(await typeName("TEXT[]"))).toEqual({ name: "text", args: [], array: true });
  });

  it("keeps a user type's name, without the public schema", async () => {
    expect(pgType(await typeName('"Role"'))).toEqual({ name: "Role", args: [], array: false });
    expect(pgType(await typeName('"public"."Role"'))).toEqual({
      name: "Role",
      args: [],
      array: false,
    });
  });
});
