// Core types shared by the pipeline (docs/ARCHITECTURE.md "Core types"). Only what exists so far:
// T3.3 adds the constraint, index, enum and data changes to the Change union.

export type Severity = "SAFE" | "RISKY" | "UNSAFE";

/** Where an entry comes from: a whole migration (history diff, unparsable file). */
export interface MigrationSource {
  readonly kind: "migration";
  /** Migration folder name, e.g. `20261116130000_fullname_phone`. */
  readonly migration: string;
}

/** Where an entry comes from: one action of one statement in a migration. */
export interface StatementSource {
  readonly kind: "statement";
  readonly migration: string;
  /** 1-based line where the statement starts. */
  readonly line: number;
  /** Which action of the statement, from 0: `ALTER TABLE … DROP x, ADD y` has actions 0 and 1. */
  readonly action: number;
}

export type Source = MigrationSource | StatementSource;

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

/** A migration Postgres's parser rejects as a whole (RG-DB-021, D20). */
export interface Unparsable {
  readonly kind: "Unparsable";
  /** The parser's own message, quoted in the finding. */
  readonly message: string;
  /** 1-based line the parser stopped at, when it says. */
  readonly line: number | null;
  readonly source: MigrationSource;
}

/** A Postgres type in its internal spelling: `VARCHAR(255)` → `{ name: "varchar", args: ["255"] }`. */
export interface PgType {
  readonly name: string;
  readonly args: readonly string[];
  readonly array: boolean;
}

interface TableChange {
  /** Table name in the public schema (RULES §2: other schemas become Unrecognized). */
  readonly table: string;
  readonly source: StatementSource;
}

interface ColumnChange extends TableChange {
  readonly column: string;
}

export interface CreateTable extends TableChange {
  readonly kind: "CreateTable";
}

export interface DropTable extends TableChange {
  readonly kind: "DropTable";
}

export interface RenameTable extends TableChange {
  readonly kind: "RenameTable";
  readonly newName: string;
}

export interface AddColumn extends ColumnChange {
  readonly kind: "AddColumn";
  readonly type: PgType;
  readonly notNull: boolean;
  /** The database fills a value: `DEFAULT`, `SERIAL` or an identity/generated column. */
  readonly hasDefault: boolean;
}

export interface DropColumn extends ColumnChange {
  readonly kind: "DropColumn";
}

export interface RenameColumn extends ColumnChange {
  readonly kind: "RenameColumn";
  readonly newName: string;
}

export interface AlterColumnType extends ColumnChange {
  readonly kind: "AlterColumnType";
  readonly type: PgType;
  /** `USING <expr>`: the cast is custom, so the change is never a known widening (RG-DB-008). */
  readonly using: boolean;
}

export interface SetNotNull extends ColumnChange {
  readonly kind: "SetNotNull";
}

export interface DropNotNull extends ColumnChange {
  readonly kind: "DropNotNull";
}

export interface SetDefault extends ColumnChange {
  readonly kind: "SetDefault";
}

export interface DropDefault extends ColumnChange {
  readonly kind: "DropDefault";
}

/** A statement (or one action of it) that parsed but that no normalizer models (RG-DB-022, D13). */
export interface Unrecognized {
  readonly kind: "Unrecognized";
  /** What it is, e.g. `CreateFunctionStmt` or `AlterTableStmt/AT_AddConstraint`. */
  readonly statement: string;
  /** Why it isn't modelled, e.g. "schema audit is not public". */
  readonly reason: string;
  readonly source: StatementSource;
}

export type Change =
  | EditedMigration
  | Unparsable
  | CreateTable
  | DropTable
  | RenameTable
  | AddColumn
  | DropColumn
  | RenameColumn
  | AlterColumnType
  | SetNotNull
  | DropNotNull
  | SetDefault
  | DropDefault
  | Unrecognized;
