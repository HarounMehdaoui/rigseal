import { describe, expect, it } from "vitest";
import { type HarmlessChange, harmlessChange } from "./harmless-change.ts";
import { at } from "./rule-test-support.ts";

const s = at(2);

describe("RG-DB-000 · recognized, harmless, no rule (D40)", () => {
  it.each<[HarmlessChange, string, RegExp]>([
    [
      { kind: "SetDefault", table: "User", column: "role", source: s },
      "User.role",
      /inserts still succeed/,
    ],
    [{ kind: "CreateTable", table: "Post", source: s }, "Post", /doesn't know/],
    [
      { kind: "CreateIndex", table: "User", name: "User_name_idx", source: s },
      "User_name_idx",
      /read or write/,
    ],
    [{ kind: "CreateIndex", table: "User", name: null, source: s }, "User", /read or write/],
    [{ kind: "DropIndex", name: "User_email_key", source: s }, "User_email_key", /RG-DB-023/],
    [
      { kind: "DropConstraint", table: "Post", name: "Post_authorId_fkey", source: s },
      "Post_authorId_fkey",
      /relaxes/,
    ],
    [{ kind: "RenameIndex", name: "a", newName: "b", source: s }, "a", /never names/],
    [{ kind: "CreateEnum", enum: "Role", values: ["A"], source: s }, "Role", /new type/],
    [{ kind: "DropEnum", enum: "Role", source: s }, "Role", /column/],
  ])("%j → a SAFE note on %s", (change, target, why) => {
    const entry = harmlessChange(change);
    expect(entry).toMatchObject({ ruleId: "RG-DB-000", severity: "SAFE", target, source: s });
    expect(entry.reason).toMatch(why);
    expect(entry.fix).toBeUndefined();
  });
});
