import { describe, expect, it } from "vitest";
import type { AlterColumnType, PgType } from "../types.ts";
import { alterColumnType } from "./alter-column-type.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = `
  enum Role {
    USER
  }
  model User {
    id    Int      @id
    code  String   @db.VarChar(50)
    note  String
    views Int
    score Float    @db.Real
    seen  DateTime
    role  Role
  }
`;

const type = (name: string, ...args: string[]): PgType => ({ name, args, array: false });

function judge(column: string, to: PgType, using = false) {
  const change: AlterColumnType = {
    kind: "AlterColumnType",
    table: "User",
    column,
    type: to,
    using,
    source: at(2),
  };
  return alterColumnType(change, contextFor(BASE, [change]));
}

describe("type changes (RG-DB-006/007/008, D44)", () => {
  it("narrowing (varchar(50) → varchar(10)) is RG-DB-006 RISKY", () => {
    const entry = judge("code", type("varchar", "10"));
    expect(entry).toMatchObject({ ruleId: "RG-DB-006", severity: "RISKY", target: "User.code" });
    expect(entry.reason).toMatch(/don't fit/);
    expect(entry.fix).toMatch(/wider type/);
  });

  it("narrowing Prisma's default text to varchar(20) is RG-DB-006 RISKY", () => {
    expect(judge("note", type("varchar", "20"))).toMatchObject({
      ruleId: "RG-DB-006",
      severity: "RISKY",
    });
  });

  it("a widening base's Int can't hold (int4 → int8) is RG-DB-007 RISKY", () => {
    const entry = judge("views", type("int8"));
    expect(entry).toMatchObject({ ruleId: "RG-DB-007", severity: "RISKY", target: "User.views" });
    expect(entry.reason).toMatch(/Int/);
    expect(entry.fix).toMatch(/BigInt/);
  });

  it("a widening past a JavaScript Date's milliseconds (timestamp(3) → timestamp(6)) is RG-DB-007 RISKY", () => {
    expect(judge("seen", type("timestamp", "6"))).toMatchObject({
      ruleId: "RG-DB-007",
      severity: "RISKY",
    });
  });

  it.each([
    ["varchar(50) → varchar(255), still a String", "code", type("varchar", "255")],
    ["float4 → float8, still a Float", "score", type("float8")],
    ["an unchanged type", "views", type("int4")],
  ])("%s is an RG-DB-007 SAFE note", (_why, column, to) => {
    const entry = judge(column, to);
    expect(entry).toMatchObject({ ruleId: "RG-DB-007", severity: "SAFE" });
    expect(entry.fix).toBeUndefined();
  });

  it("an unrelated type (text → int4) is RG-DB-008 UNSAFE", () => {
    const entry = judge("note", type("int4"));
    expect(entry).toMatchObject({ ruleId: "RG-DB-008", severity: "UNSAFE", target: "User.note" });
    expect(entry.reason).toMatch(/can't prove/);
    expect(entry.fix).toMatch(/expand\/contract/);
  });

  it("a USING cast is RG-DB-008 UNSAFE, even on a widening", () => {
    const entry = judge("code", type("varchar", "255"), true);
    expect(entry).toMatchObject({ ruleId: "RG-DB-008", severity: "UNSAFE" });
    expect(entry.reason).toMatch(/USING/);
  });

  it("a base type that can't be resolved (an enum column) is RG-DB-008 UNSAFE", () => {
    const entry = judge("role", type("text"));
    expect(entry).toMatchObject({ ruleId: "RG-DB-008", severity: "UNSAFE" });
    expect(entry.reason).toMatch(/enum/);
  });

  it("a column base doesn't use is an RG-DB-008 SAFE note", () => {
    expect(judge("nickname", type("int4"))).toMatchObject({
      ruleId: "RG-DB-008",
      severity: "SAFE",
    });
  });
});
