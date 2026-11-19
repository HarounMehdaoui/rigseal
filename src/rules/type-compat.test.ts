import { describe, expect, it } from "vitest";
import type { PgType } from "../types.ts";
import { typeRelation } from "./type-compat.ts";

/** `varchar(50)`, `int4`, `text[]` → a PgType. */
function t(spec: string): PgType {
  const match = /^([a-z0-9_"A-Z]+)(?:\(([^)]*)\))?(\[\])?$/.exec(spec);
  if (match === null) throw new Error(`bad type spec ${spec}`);
  const [, name = "", args, array] = match;
  return { name, args: args === undefined ? [] : args.split(","), array: array !== undefined };
}

// Every row of RULES §4's widening list (plus int2 → int8, the chain's two steps at once).
const WIDENINGS: [string, string][] = [
  ["varchar(50)", "varchar(255)"],
  ["varchar(50)", "text"],
  ["int2", "int4"],
  ["int4", "int8"],
  ["int2", "int8"],
  ["float4", "float8"],
  ["numeric(10,2)", "numeric(12,2)"],
  ["timestamp(3)", "timestamp(6)"],
  ["timestamp(3)", "timestamp"],
];

describe("typeRelation", () => {
  it.each(WIDENINGS)("%s → %s is a widening", (from, to) => {
    expect(typeRelation(t(from), t(to))).toBe("widening");
  });

  it.each(WIDENINGS)("%s ← %s (the reverse) is a narrowing", (from, to) => {
    expect(typeRelation(t(to), t(from))).toBe("narrowing");
  });

  it.each([
    ["int4", "int4"],
    ["varchar(50)", "varchar(50)"],
    ["timestamp(6)", "timestamp"],
    ["text[]", "text[]"],
  ])("%s → %s is the same type", (from, to) => {
    expect(typeRelation(t(from), t(to))).toBe("same");
  });

  it.each([
    ["text", "int4"],
    ["int4", "text"],
    ["numeric(10,2)", "numeric(12,3)"],
    ["timestamp(3)", "timestamptz(3)"],
    ["varchar(50)[]", "varchar(255)[]"],
    ["text[]", "text"],
    ['"Role"', "text"],
  ])("%s → %s is unknown (not in the list)", (from, to) => {
    expect(typeRelation(t(from), t(to))).toBe("unknown");
  });
});
