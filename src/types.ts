// Core types shared by the pipeline (docs/ARCHITECTURE.md "Core types"). Only what exists so far:
// Day 3 adds the statement source and the SQL changes to these unions.

export type Severity = "SAFE" | "RISKY" | "UNSAFE";

/** Where an entry comes from: a whole migration (history diff, unparsable file). */
export interface MigrationSource {
  readonly kind: "migration";
  /** Migration folder name, e.g. `20261116130000_fullname_phone`. */
  readonly migration: string;
}

export type Source = MigrationSource;

/** One rule's judgement. RISKY or UNSAFE makes it a finding; SAFE makes it a note. */
export interface Entry {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly target: string;
  readonly reason: string;
  readonly fix?: string;
  readonly source: Source;
}

/** A migration released in base that head edited or deleted (RG-DB-020). */
export interface EditedMigration {
  readonly kind: "EditedMigration";
  readonly edit: "modified" | "removed";
  readonly source: MigrationSource;
}

export type Change = EditedMigration;
