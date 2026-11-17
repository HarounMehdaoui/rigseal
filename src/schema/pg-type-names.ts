// Prisma's `@db.*` native type names on PostgreSQL → Postgres's internal type names (`Integer` → `int4`).
// The internal names are what the SQL parser produces, so the used set and the changes compare directly.

const PG_TYPE_NAMES: Readonly<Record<string, string>> = {
  Text: "text",
  VarChar: "varchar",
  Char: "bpchar",
  Bit: "bit",
  VarBit: "varbit",
  Uuid: "uuid",
  Xml: "xml",
  Inet: "inet",
  Citext: "citext",
  Boolean: "bool",
  SmallInt: "int2",
  Integer: "int4",
  BigInt: "int8",
  Oid: "oid",
  Real: "float4",
  DoublePrecision: "float8",
  Decimal: "numeric",
  Money: "money",
  Timestamp: "timestamp",
  Timestamptz: "timestamptz",
  Date: "date",
  Time: "time",
  Timetz: "timetz",
  Json: "json",
  JsonB: "jsonb",
  ByteA: "bytea",
};

/** `undefined` for a name not in the table: getDMMF only accepts these, so that means a Prisma upgrade. */
export function pgTypeName(prismaName: string): string | undefined {
  return PG_TYPE_NAMES[prismaName];
}
