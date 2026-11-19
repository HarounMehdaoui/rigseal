// The widening list (RULES §4): classifies a base → head Postgres type as same, widening, narrowing or unknown.
import type { PgType } from "../types.ts";

export type TypeRelation = "same" | "widening" | "narrowing" | "unknown";

/** Each step widens: every value of the left type fits the right one. The list is short on purpose. */
const INTEGER_CHAIN = ["int2", "int4", "int8"];

/** Postgres's precision when `timestamp` has none: microseconds. */
const DEFAULT_TIMESTAMP_PRECISION = 6;

/**
 * Anything not on the list is `unknown`, which RG-DB-008 treats as UNSAFE (fail-closed). Arrays never
 * widen: only an unchanged array type is known.
 */
export function typeRelation(from: PgType, to: PgType): TypeRelation {
  if (same(from, to)) return "same";
  if (from.array || to.array) return "unknown";
  if (widens(from, to)) return "widening";
  if (widens(to, from)) return "narrowing";
  return "unknown";
}

function same(a: PgType, b: PgType): boolean {
  if (a.name !== b.name || a.array !== b.array) return false;
  if (a.name === "timestamp") return precision(a) === precision(b);
  return a.args.length === b.args.length && a.args.every((arg, i) => arg === b.args[i]);
}

function widens(from: PgType, to: PgType): boolean {
  // varchar(n) → varchar(m) with m > n; varchar(n) → text.
  if (from.name === "varchar" && from.args.length === 1) {
    if (to.name === "text") return true;
    if (to.name === "varchar" && to.args.length === 1) return num(to.args[0]) > num(from.args[0]);
  }
  // smallint → integer → bigint.
  const fromRank = INTEGER_CHAIN.indexOf(from.name);
  const toRank = INTEGER_CHAIN.indexOf(to.name);
  if (fromRank !== -1 && toRank !== -1) return toRank > fromRank;
  // real → double precision.
  if (from.name === "float4" && to.name === "float8") return true;
  // numeric(p,s) → numeric(p',s) with p' > p: same scale, more digits.
  if (
    from.name === "numeric" &&
    to.name === "numeric" &&
    from.args.length > 0 &&
    to.args.length > 0
  ) {
    return scale(from) === scale(to) && num(to.args[0]) > num(from.args[0]);
  }
  // timestamp(p) → timestamp(p') with p' > p.
  if (from.name === "timestamp" && to.name === "timestamp") return precision(to) > precision(from);
  return false;
}

function precision(type: PgType): number {
  return type.args.length === 0 ? DEFAULT_TIMESTAMP_PRECISION : num(type.args[0]);
}

/** `numeric(p)` has scale 0. */
function scale(type: PgType): number {
  return type.args.length < 2 ? 0 : num(type.args[1]);
}

/** A type argument as a number; anything unreadable is NaN, which compares false and so stays unknown. */
function num(arg: string | undefined): number {
  return arg === undefined || !/^\d+$/.test(arg) ? Number.NaN : Number(arg);
}
