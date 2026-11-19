import { describe, expect, it } from "vitest";
import type { UsedSet } from "../schema/types.ts";
import type { Change } from "../types.ts";
import { judge } from "./judge.ts";

const context = { used: { tables: new Map(), enums: new Map() } satisfies UsedSet, changes: [] };
const migration = { kind: "migration", migration: "1_init" } as const;

describe("judge", () => {
  it("sends an edited migration to RG-DB-020", () => {
    const change: Change = { kind: "EditedMigration", edit: "modified", source: migration };
    expect(judge(change, context)).toMatchObject({ ruleId: "RG-DB-020", severity: "RISKY" });
  });

  it("sends an unparsable migration to RG-DB-021", () => {
    const change: Change = { kind: "Unparsable", message: "boom", line: 1, source: migration };
    expect(judge(change, context)).toMatchObject({ ruleId: "RG-DB-021", severity: "UNSAFE" });
  });

  it("sends a dropped column to RG-DB-002 with the context", () => {
    const change: Change = {
      kind: "DropColumn",
      table: "User",
      column: "name",
      source: { kind: "statement", migration: "2_drop", line: 1, action: 0 },
    };
    expect(judge(change, context)).toMatchObject({ ruleId: "RG-DB-002", severity: "SAFE" });
  });

  it("names the missing rule for a kind no rule judges yet", () => {
    const change: Change = {
      kind: "SetDefault",
      table: "User",
      column: "name",
      source: { kind: "statement", migration: "2_set", line: 1, action: 0 },
    };
    expect(() => judge(change, context)).toThrow("no rule for SetDefault yet");
  });
});
