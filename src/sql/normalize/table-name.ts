// Resolves a table reference to its name in the public schema; any other schema is refused (RULES §2).
import type { Node, RangeVar } from "../parse.ts";

export type TableRef =
  | { readonly ok: true; readonly table: string }
  | { readonly ok: false; readonly reason: string };

/** `ALTER TABLE "public"."User"`, `CREATE TABLE "User"`: the parser's RangeVar. */
export function fromRangeVar(relation: RangeVar | undefined): TableRef {
  if (relation?.relname === undefined) return { ok: false, reason: "the statement names no table" };
  return inPublic(relation.schemaname, relation.relname);
}

/** `DROP TABLE "public"."User"`: a list of name parts, schema first when there is one. */
export function fromNameList(node: Node | undefined): TableRef {
  const parts =
    node !== undefined && "List" in node
      ? (node.List.items ?? []).map((item) => ("String" in item ? item.String.sval : undefined))
      : [];
  const [first, second, third] = parts;
  if (parts.length === 1 && first !== undefined) return inPublic(undefined, first);
  if (parts.length === 2 && first !== undefined && second !== undefined) {
    return inPublic(first, second);
  }
  if (parts.length === 3 && third !== undefined) {
    return { ok: false, reason: `"${parts.join(".")}" names another database` };
  }
  return { ok: false, reason: "the table name could not be read" };
}

function inPublic(schema: string | undefined, table: string): TableRef {
  if (schema === undefined || schema === "public") return { ok: true, table };
  return { ok: false, reason: `schema "${schema}" is not public (v0.1 is public-only)` };
}
