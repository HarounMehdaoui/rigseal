import { describe, expect, it } from "vitest";
import { scalarCovers } from "./scalar-coverage.ts";

const type = (name: string, ...args: string[]) => ({ name, args, array: false });

describe("scalarCovers", () => {
  it.each([
    ["Int", type("int2")],
    ["Int", type("int4")],
    ["BigInt", type("int8")],
    ["Float", type("float8")],
    ["Decimal", type("numeric", "12", "2")],
    ["String", type("varchar", "255")],
    ["String", type("text")],
    ["DateTime", type("timestamp", "3")],
  ])("%s covers %j", (scalar, pg) => {
    expect(scalarCovers(scalar, pg)).toBe(true);
  });

  it.each([
    ["Int", type("int8")],
    ["DateTime", type("timestamp", "6")],
    ["DateTime", type("timestamp")],
    ["String", type("int4")],
  ])("%s doesn't cover %j", (scalar, pg) => {
    expect(scalarCovers(scalar, pg)).toBe(false);
  });
});
