import { describe, expect, it } from "vitest";
import type { Analysis } from "../analyze.ts";
import { buildReport } from "./build-report.ts";

const USED_USER: Analysis["used"] = { tables: new Map([["User", {} as never]]), enums: new Map() };
const NO_TABLES: Analysis["used"] = { tables: new Map(), enums: new Map() };

function input(analysis: Partial<Analysis>, migrationsDir = "prisma/migrations") {
  return {
    version: "1.2.3",
    base: { ref: "v1", sha: "a".repeat(40), method: "tag" as const },
    head: { ref: "HEAD", sha: "b".repeat(40) },
    migrationsDir,
    analysis: { entries: [], history: [], used: USED_USER, ...analysis },
  };
}

describe("buildReport", () => {
  it("states the schema version, tool, base and head (D24)", () => {
    const report = buildReport(input({}));
    expect(report).toMatchObject({
      schemaVersion: 1,
      tool: { name: "rollback-gate", version: "1.2.3" },
      verdict: "SAFE",
      base: { ref: "v1", sha: "a".repeat(40), method: "tag" },
      head: { ref: "HEAD", sha: "b".repeat(40) },
      warnings: [],
      migrations: [],
      entries: [],
    });
  });

  it("flattens entries to repo-relative files; whole-migration entries get line 0 (D49)", () => {
    const report = buildReport(
      input(
        {
          entries: [
            {
              ruleId: "RG-DB-021",
              severity: "UNSAFE",
              target: "2_bad",
              reason: "r",
              fix: "f",
              source: { kind: "migration", migration: "2_bad" },
            },
            {
              ruleId: "RG-DB-000",
              severity: "SAFE",
              target: "i",
              reason: "harmless",
              source: { kind: "statement", migration: "3_ok", line: 4, action: 1 },
            },
          ],
        },
        "./db/migrations/",
      ),
    );
    expect(report.verdict).toBe("UNSAFE");
    expect(report.entries).toEqual([
      {
        ruleId: "RG-DB-021",
        severity: "UNSAFE",
        target: "2_bad",
        file: "db/migrations/2_bad/migration.sql",
        line: 0,
        action: 0,
        reason: "r",
        fix: "f",
      },
      {
        ruleId: "RG-DB-000",
        severity: "SAFE",
        target: "i",
        file: "db/migrations/3_ok/migration.sql",
        line: 4,
        action: 1,
        reason: "harmless",
      },
    ]);
    expect("fix" in (report.entries[1] ?? {})).toBe(false);
  });

  it("lists every migration on either side, with head's hash or base's for a removed one", () => {
    const report = buildReport(
      input({
        history: [
          { name: "1_a", status: "unchanged", base: "h1", head: "h1" },
          { name: "2_b", status: "modified", base: "old", head: "new" },
          { name: "3_c", status: "removed", base: "gone", head: null },
          { name: "4_d", status: "new", base: null, head: "h4" },
        ],
      }),
    );
    expect(report.migrations).toEqual([
      { file: "prisma/migrations/1_a/migration.sql", status: "unchanged", sha256: "h1" },
      { file: "prisma/migrations/2_b/migration.sql", status: "modified", sha256: "new" },
      { file: "prisma/migrations/3_c/migration.sql", status: "removed", sha256: "gone" },
      { file: "prisma/migrations/4_d/migration.sql", status: "new", sha256: "h4" },
    ]);
  });

  it("warns about a fallback base, then about a base that uses no tables (D5, D37)", () => {
    const report = buildReport({
      ...input({ used: NO_TABLES }),
      base: { ref: "main", sha: "c".repeat(40), method: "fallback", warning: "No tag." },
    });
    expect(report.base).toEqual({ ref: "main", sha: "c".repeat(40), method: "fallback" });
    expect(report.warnings).toEqual([
      "No tag.",
      "Base's schema maps no tables, so nothing in head can break it. Check that base is the right release.",
    ]);
  });
});
