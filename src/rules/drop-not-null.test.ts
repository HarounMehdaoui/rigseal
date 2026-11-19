import { describe, expect, it } from "vitest";
import type { DropNotNull } from "../types.ts";
import { dropNotNull } from "./drop-not-null.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model User {\n  id       Int     @id\n  name     String\n  nickname String?\n}\n";

function judge(column: string) {
  const change: DropNotNull = { kind: "DropNotNull", table: "User", column, source: at(2) };
  return dropNotNull(change, contextFor(BASE, [change]));
}

describe("RG-DB-010 · drop NOT NULL", () => {
  it("is RISKY on a column base has as required: base would read a NULL its type says can't exist", () => {
    const entry = judge("name");
    expect(entry).toMatchObject({ ruleId: "RG-DB-010", severity: "RISKY", target: "User.name" });
    expect(entry.reason).toMatch(/returns null/);
    expect(entry.fix).toMatch(/keep writing/i);
  });

  it("gives a SAFE note when base's field is already optional", () => {
    expect(judge("nickname")).toMatchObject({ ruleId: "RG-DB-010", severity: "SAFE" });
  });

  it("gives a SAFE note for a column base doesn't use", () => {
    expect(judge("legacy")).toMatchObject({ ruleId: "RG-DB-010", severity: "SAFE" });
  });
});
