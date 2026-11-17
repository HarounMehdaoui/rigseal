// Prisma 7.10.1's implicit choices on PostgreSQL: what a field gets when the schema doesn't say.
import type { Field } from "./dmmf.ts";
import { unexpected } from "./schema-error.ts";
import type { ColumnDefault, NativeType } from "./types.ts";

/** Prisma's native type for a scalar without `@db.*` (RULES §4, §6 row 2). */
const DEFAULT_NATIVE_TYPES: Readonly<Record<string, NativeType>> = {
  String: { name: "Text", args: [] },
  Int: { name: "Integer", args: [] },
  BigInt: { name: "BigInt", args: [] },
  Float: { name: "DoublePrecision", args: [] },
  Decimal: { name: "Decimal", args: ["65", "30"] },
  DateTime: { name: "Timestamp", args: ["3"] },
  Boolean: { name: "Boolean", args: [] },
  Json: { name: "JsonB", args: [] },
  Bytes: { name: "ByteA", args: [] },
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

/** The field's `@db.*` type, else Prisma's default for its scalar. `where` names it in errors. */
export function nativeType(field: Field, where: string): NativeType {
  if (field.nativeType) {
    const [name, args] = field.nativeType;
    return { name, args: [...args] };
  }
  return (
    DEFAULT_NATIVE_TYPES[field.type] ?? unexpected(`${where}: unknown scalar type ${field.type}`)
  );
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
