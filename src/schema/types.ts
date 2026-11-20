// The used set's shape: what base's Prisma client reads and writes, under database names.
import type { PgType } from "../types.ts";

/** Which `@default` a field has: a fixed value (`literal`) or the function that makes the value. */
export type DefaultKind =
  | "literal"
  | "autoincrement"
  | "dbgenerated"
  | "now"
  | "uuid"
  | "cuid"
  | "ulid"
  | "nanoid";

export interface ColumnDefault {
  readonly kind: DefaultKind;
  /** Who fills the value when base's code omits the field (RG-DB-011). */
  readonly appliedBy: "database" | "prisma";
}

export interface UsedColumn {
  /** Database name (`@map`, else the field name). */
  readonly name: string;
  /** Prisma field name, for messages. */
  readonly field: string;
  /** Prisma type as written: `String`, `Int`, … or the enum's Prisma name. */
  readonly prismaType: string;
  /** In Postgres's spelling (`int4`, `varchar(255)`): `@db.*`, else Prisma's default for the scalar. `null` for enum columns: their type is the enum. */
  readonly nativeType: PgType | null;
  readonly optional: boolean;
  readonly list: boolean;
  readonly default: ColumnDefault | null;
  /** Database name of the column's enum type, if it has one. */
  readonly enum: string | null;
}

export interface UsedTable {
  /** Database name (`@@map`, else the model name). */
  readonly name: string;
  /** Prisma model name, for messages. */
  readonly model: string;
  /** Keyed by database column name, in schema order. */
  readonly columns: ReadonlyMap<string, UsedColumn>;
}

export interface UsedEnum {
  /** Database name (`@@map`, else the enum name). */
  readonly name: string;
  /** Prisma enum name, for messages. */
  readonly enumName: string;
  /** Database names of the values (`@map`, else the value name), in schema order. */
  readonly values: readonly string[];
}

export interface UsedSet {
  /** Keyed by database table name. */
  readonly tables: ReadonlyMap<string, UsedTable>;
  /** Keyed by database enum name. */
  readonly enums: ReadonlyMap<string, UsedEnum>;
}
