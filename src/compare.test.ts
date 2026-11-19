import { describe, expect, it } from "vitest";
import { byCodeUnit } from "./compare.ts";

describe("byCodeUnit", () => {
  it("orders by code unit, not by locale: uppercase before lowercase, digits before letters", () => {
    expect(["b", "a", "B", "10", "9", "_x"].sort(byCodeUnit)).toEqual([
      "10",
      "9",
      "B",
      "_x",
      "a",
      "b",
    ]);
  });

  it("returns 0 for equal strings", () => {
    expect(byCodeUnit("same", "same")).toBe(0);
  });
});
