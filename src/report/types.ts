// The report's shape: the one data structure the JSON, Markdown and text renderers all read.
import type { MigrationStatus } from "../migrations/history.ts";
import type { Severity } from "../types.ts";

export type BaseMethod = "tag" | "fallback" | "explicit";

/** One entry, flattened: every entry has the same keys; whole-migration entries use line 0. */
export interface ReportEntry {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly target: string;
  /** Repo-relative path of the migration file, e.g. `prisma/migrations/<name>/migration.sql`. */
  readonly file: string;
  readonly line: number;
  readonly action: number;
  readonly reason: string;
  /** Left out when the rule gives none: the JSON never holds a null. */
  readonly fix?: string;
}

export interface ReportMigration {
  readonly file: string;
  readonly status: MigrationStatus;
  /** Head's fingerprint; base's for a removed migration. */
  readonly sha256: string;
}

export interface Report {
  readonly schemaVersion: 1;
  readonly tool: { readonly name: "rigseal"; readonly version: string };
  readonly verdict: Severity;
  readonly base: { readonly ref: string; readonly sha: string; readonly method: BaseMethod };
  readonly head: { readonly ref: string; readonly sha: string };
  readonly warnings: readonly string[];
  readonly migrations: readonly ReportMigration[];
  /** In report order: file, line, rule ID, target, action. */
  readonly entries: readonly ReportEntry[];
}
