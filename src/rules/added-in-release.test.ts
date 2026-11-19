import { describe, expect, it } from "vitest";
import type { AddColumn } from "../types.ts";
import { addedInRelease } from "./added-in-release.ts";
import { at, contextFor } from "./rule-test-support.ts";

const add: AddColumn = {
  kind: "AddColumn",
  table: "User",
  column: "phone",
  type: { name: "text", args: [], array: false },
  notNull: false,
  hasDefault: false,
  source: at(2),
};

describe("addedInRelease", () => {
  it("is true for a column the release adds", () => {
    expect(addedInRelease("User", "phone", contextFor("", [add]))).toBe(true);
  });

  it("is false for another column, or another table's column of the same name", () => {
    const context = contextFor("", [add]);
    expect(addedInRelease("User", "email", context)).toBe(false);
    expect(addedInRelease("Post", "phone", context)).toBe(false);
  });
});
