import { describe, expect, it } from "vitest";
import type { AddColumn, Change, DropDefault } from "../types.ts";
import { dropDefault } from "./drop-default.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = `
  model User {
    id        Int      @id @default(autoincrement())
    slug      String?  @default(dbgenerated("gen_random_uuid()::text"))
    createdAt DateTime @default(now())
    role      String   @default("user")
    plain     String
  }
`;

function judge(column: string, others: Change[] = []) {
  const change: DropDefault = { kind: "DropDefault", table: "User", column, source: at(4) };
  return dropDefault(change, contextFor(BASE, [...others, change]));
}

describe("RG-DB-011 · drop default", () => {
  it("is UNSAFE for autoincrement() on a NOT NULL column: base never sends the id", () => {
    const entry = judge("id");
    expect(entry).toMatchObject({ ruleId: "RG-DB-011", severity: "UNSAFE", target: "User.id" });
    expect(entry.reason).toMatch(/autoincrement\(\).*fail/);
    expect(entry.fix).toMatch(/keep the default/i);
  });

  it("is RISKY for dbgenerated() on a nullable column: base's inserts store NULL instead", () => {
    const entry = judge("slug");
    expect(entry).toMatchObject({ ruleId: "RG-DB-011", severity: "RISKY" });
    expect(entry.reason).toMatch(/NULL/);
  });

  it("uses the column's nullability after the whole release (a DROP NOT NULL makes it RISKY)", () => {
    const relaxed: Change = { kind: "DropNotNull", table: "User", column: "id", source: at(3) };
    expect(judge("id", [relaxed]).severity).toBe("RISKY");
  });

  it.each([
    ["now(), which Prisma sends itself", "createdAt"],
    ["a literal, which Prisma sends itself", "role"],
    ["no @default in base", "plain"],
  ])("gives a SAFE note for %s", (_why, column) => {
    const entry = judge(column);
    expect(entry).toMatchObject({ ruleId: "RG-DB-011", severity: "SAFE" });
    expect(entry.fix).toBeUndefined();
  });

  it("gives a SAFE note for a column added in this release (the lab's backfill hand-edit)", () => {
    const added: AddColumn = {
      kind: "AddColumn",
      table: "User",
      column: "phone",
      type: { name: "text", args: [], array: false },
      notNull: true,
      hasDefault: true,
      source: at(2),
    };
    const entry = judge("phone", [added]);
    expect(entry).toMatchObject({ ruleId: "RG-DB-011", severity: "SAFE" });
    expect(entry.reason).toMatch(/RG-DB-005/);
  });
});
