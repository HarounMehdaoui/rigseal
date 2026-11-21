// Assembles the Report from an analysis and the run's facts: version, base, head, migrations folder.
import type { Analysis } from "../analyze.ts";
import type { HistoryEntry } from "../migrations/history.ts";
import { normalizeRepoPath } from "../repo-path.ts";
import type { Entry } from "../types.ts";
import { verdictOf } from "../verdict.ts";
import type { BaseMethod, Report, ReportEntry, ReportMigration } from "./types.ts";

export interface ReportInput {
  readonly version: string;
  readonly base: {
    readonly ref: string;
    readonly sha: string;
    readonly method: BaseMethod;
    readonly warning?: string;
  };
  readonly head: { readonly ref: string; readonly sha: string };
  /** As the user gave it (`--migrations`); normalized here so `./x/` and `x` give the same bytes. */
  readonly migrationsDir: string;
  readonly analysis: Analysis;
}

const NO_TABLES =
  "Base's schema maps no tables, so nothing in head can break it. Check that base is the right release.";

export function buildReport({ version, base, head, migrationsDir, analysis }: ReportInput): Report {
  const dir = normalizeRepoPath(migrationsDir);
  const file = (migration: string) => `${dir}/${migration}/migration.sql`;

  const warnings: string[] = [];
  if (base.warning !== undefined) warnings.push(base.warning);
  // An empty used set makes every change look SAFE; say so instead of staying quiet.
  if (analysis.used.tables.size === 0) warnings.push(NO_TABLES);

  return {
    schemaVersion: 1,
    tool: { name: "rigseal", version },
    verdict: verdictOf(analysis.entries),
    base: { ref: base.ref, sha: base.sha, method: base.method },
    head: { ref: head.ref, sha: head.sha },
    warnings,
    migrations: analysis.history.map((h) => migration(h, file(h.name))),
    entries: analysis.entries.map((e) => entry(e, file(e.source.migration))),
  };
}

function migration(h: HistoryEntry, file: string): ReportMigration {
  // A removed migration has no head hash; one of the two is always present.
  const sha256 = h.head ?? h.base;
  if (sha256 === null) throw new Error(`migration ${h.name} has no fingerprint on either side`);
  return { file, status: h.status, sha256 };
}

function entry(e: Entry, file: string): ReportEntry {
  const statement = e.source.kind === "statement";
  return {
    ruleId: e.ruleId,
    severity: e.severity,
    target: e.target,
    file,
    // Whole-migration entries (RG-DB-020, RG-DB-021) sit at line 0 of their file.
    line: statement ? e.source.line : 0,
    action: statement ? e.source.action : 0,
    reason: e.reason,
    ...(e.fix === undefined ? {} : { fix: e.fix }),
  };
}
