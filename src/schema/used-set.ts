// Base's schema.prisma → the used set: what base's Prisma client reads and writes (RULES §2, D8).
// Rules check head's migrations against this set only; head's schema is never consulted.
import { stripVTControlCharacters } from "node:util";
import { getDMMF } from "@prisma/get-dmmf";

/** A native type in Prisma's own spelling: `@db.VarChar(255)` → `{ name: "VarChar", args: ["255"] }`. */
export interface NativeType {
  readonly name: string;
  readonly args: readonly string[];
}

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
  /** Who fills the value when base's code omits the field (RULES §6 row 5, RG-DB-011). */
  readonly appliedBy: "database" | "prisma";
}

export interface UsedColumn {
  /** Database name (`@map`, else the field name). */
  readonly name: string;
  /** Prisma field name, for messages. */
  readonly field: string;
  /** Prisma type as written: `String`, `Int`, … or the enum's Prisma name. */
  readonly prismaType: string;
  /** `@db.*`, else Prisma's default for the scalar. `null` for enum columns: their type is the enum. */
  readonly nativeType: NativeType | null;
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

/** Base's schema can't be read: a real tool failure (exit 2), not a finding. */
export class SchemaError extends Error {
  override readonly name = "SchemaError";
}

// getDMMF's own types, derived from its signature so we don't import @prisma/dmmf directly.
type Datamodel = Extract<ReturnType<typeof getDMMF>, { datamodel: unknown }>["datamodel"];
type Field = Datamodel["models"][number]["fields"][number];

/** Prisma's native type for a scalar without `@db.*` on PostgreSQL (RULES §4, §6 row 2). */
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

/**
 * Builds the used set from base's schema text. Pure: getDMMF runs in WebAssembly, with no I/O.
 * `@ignore` fields, `@@ignore` models and `Unsupported(...)` fields never reach us: getDMMF
 * leaves them out (T2.2). A schema with no models gives an empty set; the report warns (D37).
 */
export function buildUsedSet(schemaText: string): UsedSet {
  const datamodel = readDatamodel(schemaText);
  const enumNames = new Map(datamodel.enums.map((e) => [e.name, e.dbName ?? e.name]));
  const usedEnums = new Set<string>();
  const tables = new Map<string, UsedTable>();

  for (const model of datamodel.models) {
    // v0.1 is public-only (RULES §2): statements on other schemas are RG-DB-022 anyway.
    if ((model.schema ?? "public") !== "public") continue;

    const columns = new Map<string, UsedColumn>();
    for (const field of model.fields) {
      // Relation fields (`object`) have no column; their foreign-key scalars are separate fields.
      if (field.kind !== "scalar" && field.kind !== "enum") continue;

      const where = `${model.name}.${field.name}`;
      let enumName: string | null = null;
      if (field.kind === "enum") {
        enumName = enumNames.get(field.type) ?? fail(`${where}: enum ${field.type} not found`);
        usedEnums.add(field.type);
      }
      const name = field.dbName ?? field.name;
      columns.set(name, {
        name,
        field: field.name,
        prismaType: field.type,
        nativeType: enumName === null ? nativeType(field, where) : null,
        optional: !field.isRequired,
        list: field.isList,
        default: columnDefault(field, where),
        enum: enumName,
      });
    }

    const name = model.dbName ?? model.name;
    tables.set(name, { name, model: model.name, columns });
  }

  const enums = new Map<string, UsedEnum>();
  for (const e of datamodel.enums) {
    if (!usedEnums.has(e.name)) continue;
    const name = e.dbName ?? e.name;
    enums.set(name, { name, enumName: e.name, values: e.values.map((v) => v.dbName ?? v.name) });
  }

  return { tables, enums };
}

/** getDMMF returns errors instead of throwing (T2.2); turn them into a thrown SchemaError. */
function readDatamodel(schemaText: string): Datamodel {
  const result = getDMMF({ datamodel: schemaText });
  if ("reason" in result) {
    throw new SchemaError(`base schema.prisma is invalid: ${prismaMessage(result.error)}`);
  }
  return result.datamodel;
}

/** Prisma wraps its message in JSON (`{"error_code":"P1012","message":…}`) with colour codes. */
function prismaMessage(error: Error): string {
  let text = error.message;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && "message" in parsed) {
      if (typeof parsed.message === "string") text = parsed.message;
    }
  } catch {
    // Not JSON: keep the message as it is.
  }
  return stripVTControlCharacters(text).trim();
}

function nativeType(field: Field, where: string): NativeType {
  if (field.nativeType) {
    const [name, args] = field.nativeType;
    return { name, args: [...args] };
  }
  return DEFAULT_NATIVE_TYPES[field.type] ?? fail(`${where}: unknown scalar type ${field.type}`);
}

function columnDefault(field: Field, where: string): ColumnDefault | null {
  const value = field.default;
  if (value === undefined) return null;
  // A function default is `{ name, args }`; a literal (also an enum value or a list) is not.
  if (typeof value === "object" && "name" in value) {
    return DEFAULT_FUNCTIONS[value.name] ?? fail(`${where}: unknown @default(${value.name}())`);
  }
  return LITERAL_DEFAULT;
}

/** For states getDMMF 7.10.1 never produces: a Prisma upgrade broke our assumptions. */
function fail(message: string): never {
  throw new SchemaError(`${message} (unexpected from Prisma 7.10.1)`);
}
