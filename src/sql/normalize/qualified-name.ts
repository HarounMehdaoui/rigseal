// Resolves a possibly schema-qualified name (table, index, enum) in the public schema; refuses any other.
import type { Node, RangeVar } from "../parse.ts";

export type NameRef =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly reason: string };

/** `ALTER TABLE "public"."User"`, `CREATE INDEX … ON "User"`, `ALTER INDEX "i"`: a RangeVar. */
export function fromRangeVar(relation: RangeVar | undefined): NameRef {
  if (relation?.relname === undefined)
    return { ok: false, reason: "the statement names no object" };
  return inPublic([
    ...(relation.schemaname === undefined ? [] : [relation.schemaname]),
    relation.relname,
  ]);
}

/**
 * A name given as parts, schema first when there is one: `DROP TABLE` / `DROP INDEX` objects (a
 * List), `DROP TYPE` objects (a TypeName), `CREATE TYPE` / `ALTER TYPE` names (a bare array).
 */
export function fromNameParts(node: Node | readonly Node[] | undefined): NameRef {
  return inPublic(nameParts(node));
}

function nameParts(node: Node | readonly Node[] | undefined): (string | undefined)[] {
  if (node === undefined) return [];
  if (Array.isArray(node))
    return node.map((part: Node) => ("String" in part ? part.String.sval : undefined));
  const single = node as Node;
  if ("List" in single) return nameParts(single.List.items ?? []);
  if ("TypeName" in single) return nameParts(single.TypeName.names ?? []);
  return [];
}

function inPublic(parts: readonly (string | undefined)[]): NameRef {
  if (parts.some((part) => part === undefined) || parts.length === 0) {
    return { ok: false, reason: "the name could not be read" };
  }
  const [first, second] = parts as readonly string[];
  if (parts.length === 1 && first !== undefined) return { ok: true, name: first };
  if (parts.length === 2 && first !== undefined && second !== undefined) {
    return first === "public"
      ? { ok: true, name: second }
      : { ok: false, reason: `schema "${first}" is not public (v0.1 is public-only)` };
  }
  return { ok: false, reason: `"${parts.join(".")}" names another database` };
}
