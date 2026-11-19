// Which Postgres types each Prisma scalar represents in full (RULES §4, RG-DB-007).
import type { PgType } from "../types.ts";

/** A JavaScript Date keeps milliseconds, so DateTime holds timestamp(p) only for p ≤ 3. */
const DATE_PRECISION = 3;

const COVERED: Readonly<Record<string, readonly string[]>> = {
  Int: ["int2", "int4"],
  BigInt: ["int2", "int4", "int8"],
  Float: ["float4", "float8"],
  Decimal: ["numeric"],
  String: ["varchar", "text"],
  DateTime: ["timestamp"],
};

export function scalarCovers(prismaType: string, type: PgType): boolean {
  if (!(COVERED[prismaType] ?? []).includes(type.name)) return false;
  if (prismaType !== "DateTime") return true;
  // No precision means Postgres's default, microseconds: more than a Date holds.
  const [p] = type.args;
  return p !== undefined && /^\d+$/.test(p) && Number(p) <= DATE_PRECISION;
}
