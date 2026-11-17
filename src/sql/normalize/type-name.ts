// Reads a parsed type name into a PgType in Postgres's internal spelling (`INTEGER` → `int4`).
import type { PgType } from "../../types.ts";
import type { Node, TypeName } from "../parse.ts";

/**
 * The parser already turns SQL spellings into internal ones (`INTEGER` → `pg_catalog.int4`,
 * `DECIMAL` → `pg_catalog.numeric`); this drops the `pg_catalog` / `public` schema and reads the
 * arguments (`VARCHAR(255)` → `["255"]`).
 */
export function pgType(typeName: TypeName): PgType {
  const parts = (typeName.names ?? []).map((n) => ("String" in n ? (n.String.sval ?? "") : ""));
  const [schema, name] = parts;
  const builtIn = parts.length === 2 && (schema === "pg_catalog" || schema === "public");
  return {
    name: builtIn && name !== undefined ? name : parts.join("."),
    args: (typeName.typmods ?? []).map(typmod),
    array: (typeName.arrayBounds ?? []).length > 0,
  };
}

/** One type argument. The parser leaves zero out of its output, so a missing value means 0. */
function typmod(node: Node): string {
  if (!("A_Const" in node)) return "?";
  const value = node.A_Const;
  if (value.ival !== undefined) return String(value.ival.ival ?? 0);
  if (value.sval !== undefined) return value.sval.sval ?? "";
  if (value.fval !== undefined) return value.fval.fval ?? "0";
  return "?";
}
