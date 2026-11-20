// What a Prisma 7.10.1 field means as a Postgres column: its type (`@db.*` or Prisma's default) and who fills its default.

import type { PgType } from "../types.ts";
import type { Field } from "./dmmf.ts";
import { pgTypeName } from "./pg-type-names.ts";
import { unexpected } from "./schema-error.ts";
import type { ColumnDefault } from "./types.ts";

/** Prisma's native type for a scalar without `@db.*`, in Postgres's spelling. */
const DEFAULT_TYPES: Readonly<Record<string, { readonly name: string; readonly args: string[] }>> =
  {
    String: { name: "text", args: [] },
    Int: { name: "int4", args: [] },
    BigInt: { name: "int8", args: [] },
    Float: { name: "float8", args: [] },
    Decimal: { name: "numeric", args: ["65", "30"] },
    DateTime: { name: "timestamp", args: ["3"] },
    Boolean: { name: "bool", args: [] },
    Json: { name: "jsonb", args: [] },
    Bytes: { name: "bytea", args: [] },
  };

/**
 * Every `@default` function Prisma 7.10.1 accepts on PostgreSQL, and who applies it (§6 row 5).
 * getDMMF rejects any other name, so a miss here means Prisma was upgraded without this table.
 */
const DEFAULT_FUNCTIONS: Readonly<Record<string, ColumnDefault>> = {
  autoincrement: { kind: "autoincrement", appliedBy: "database" },
  dbgenerated: { kind: "dbgenerated", appliedBy: "database" },
  now: { kind: "now", appliedBy: "prisma" },
  uuid: { kind: "uuid", appliedBy: "prisma" },
  cuid: { kind: "cuid", appliedBy: "prisma" },
  ulid: { kind: "ulid", appliedBy: "prisma" },
  nanoid: { kind: "nanoid", appliedBy: "prisma" },
};

const LITERAL_DEFAULT: ColumnDefault = { kind: "literal", appliedBy: "prisma" };

/** The column's Postgres type: its `@db.*` type, else Prisma's default for its scalar. */
export function nativeType(field: Field, where: string): PgType {
  const array = field.isList;
  if (field.nativeType) {
    const [prismaName, args] = field.nativeType;
    const name =
      pgTypeName(prismaName) ?? unexpected(`${where}: unknown native type @db.${prismaName}`);
    return { name, args: [...args], array };
  }
  const fallback =
    DEFAULT_TYPES[field.type] ?? unexpected(`${where}: unknown scalar type ${field.type}`);
  return { ...fallback, array };
}

/** The field's `@default` and who applies it, or `null` without one (`@updatedAt` has none). */
export function columnDefault(field: Field, where: string): ColumnDefault | null {
  const value = field.default;
  if (value === undefined) return null;
  // A function default is `{ name, args }`; a literal (also an enum value or a list) is not.
  if (typeof value === "object" && "name" in value) {
    return (
      DEFAULT_FUNCTIONS[value.name] ?? unexpected(`${where}: unknown @default(${value.name}())`)
    );
  }
  return LITERAL_DEFAULT;
}
