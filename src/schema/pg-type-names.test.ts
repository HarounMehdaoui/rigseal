import { describe, expect, it } from "vitest";
import { pgTypeName } from "./pg-type-names.ts";

describe("pgTypeName", () => {
  it.each([
    ["Text", "text"],
    ["VarChar", "varchar"],
    ["Char", "bpchar"],
    ["Integer", "int4"],
    ["SmallInt", "int2"],
    ["BigInt", "int8"],
    ["DoublePrecision", "float8"],
    ["Real", "float4"],
    ["Decimal", "numeric"],
    ["Boolean", "bool"],
    ["Timestamp", "timestamp"],
    ["Timestamptz", "timestamptz"],
    ["Date", "date"],
    ["Time", "time"],
    ["Timetz", "timetz"],
    ["Json", "json"],
    ["JsonB", "jsonb"],
    ["ByteA", "bytea"],
    ["Uuid", "uuid"],
  ])("@db.%s → %s", (prisma, pg) => {
    expect(pgTypeName(prisma)).toBe(pg);
  });

  it("returns undefined for a name it doesn't know", () => {
    expect(pgTypeName("NoSuchType")).toBeUndefined();
  });
});
