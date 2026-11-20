import { describe, expect, it } from "vitest";
import { analyze } from "./analyze.ts";
import type { Snapshot } from "./types.ts";

const SCHEMA = 'datasource db {\n  provider = "postgresql"\n}\nmodel User {\n  id Int @id\n}\n';
const INIT = { name: "1_init", sql: 'CREATE TABLE "User" ("id" INTEGER NOT NULL);\n' };

function snapshot(...migrations: { name: string; sql: string }[]): Snapshot {
  return { schema: SCHEMA, migrations };
}

describe("analyze", () => {
  it("gives no entries when head adds no migration and edits none", async () => {
    expect((await analyze(snapshot(INIT), snapshot(INIT))).entries).toEqual([]);
  });

  it("judges an edited released migration, and never re-parses released ones", async () => {
    const edited = { name: "1_init", sql: "this is not SQL" };
    expect((await analyze(snapshot(INIT), snapshot(edited))).entries).toMatchObject([
      { ruleId: "RG-DB-020", severity: "RISKY", target: "1_init" },
    ]);
  });

  it("parses only head's new migrations, in name order", async () => {
    const { entries } = await analyze(
      snapshot(INIT),
      snapshot(INIT, { name: "3_bad", sql: "DROP;" }, { name: "2_bad", sql: "ALTER;" }),
    );
    expect(entries.map((e) => [e.ruleId, e.target])).toEqual([
      ["RG-DB-021", "2_bad"],
      ["RG-DB-021", "3_bad"],
    ]);
  });

  it("puts history entries before the new migrations' entries", async () => {
    const { entries } = await analyze(
      snapshot(INIT),
      snapshot({ name: "1_init", sql: "-- edited" }, { name: "2_bad", sql: "DROP;" }),
    );
    expect(entries.map((e) => e.ruleId)).toEqual(["RG-DB-020", "RG-DB-021"]);
  });

  it("also returns the history and base's used set, for the report", async () => {
    const result = await analyze(
      snapshot(INIT),
      snapshot(INIT, { name: "2_new", sql: "-- nothing yet\n" }),
    );
    expect(result.history.map((h) => [h.name, h.status])).toEqual([
      ["1_init", "unchanged"],
      ["2_new", "new"],
    ]);
    expect([...result.used.tables.keys()]).toEqual(["User"]);
  });

  it("reads base's schema, so an invalid one is a tool failure", async () => {
    const broken = { schema: "model {", migrations: [INIT] };
    await expect(analyze(broken, snapshot(INIT))).rejects.toMatchObject({ name: "SchemaError" });
  });
});
