// Core types shared by the pipeline (docs/ARCHITECTURE.md "Core types"). Only what exists so far:
// T5.2 adds RemoveEnumValue (the enum-recreate recognizer).

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

export interface AddConstraint extends TableChange {
  readonly kind: "AddConstraint";
  readonly constraint: "unique" | "primaryKey" | "check" | "foreignKey";
  /** `null` when the SQL doesn't name it (Postgres then picks one). */
  readonly name: string | null;
  /** The constrained columns; empty for CHECK, whose expression isn't analysed (RG-DB-013). */
  readonly columns: readonly string[];
}

export interface DropConstraint extends TableChange {
  readonly kind: "DropConstraint";
  readonly name: string;
}

export interface CreateUniqueIndex extends TableChange {
  readonly kind: "CreateUniqueIndex";
  readonly name: string | null;
  /** The plain columns indexed. */
  readonly columns: readonly string[];
  /** Some indexed parts are expressions (`lower("email")`), so `columns` isn't the whole key. */
  readonly expressions: boolean;
}

export interface CreateIndex extends TableChange {
  readonly kind: "CreateIndex";
  readonly name: string | null;
}

/** `DROP INDEX` names only the index; matching it to base's unique indexes is RG-DB-023's job. */
export interface DropIndex {
  readonly kind: "DropIndex";
  readonly name: string;
  readonly source: StatementSource;
}

export interface RenameIndex {
  readonly kind: "RenameIndex";
  readonly name: string;
  readonly newName: string;
  readonly source: StatementSource;
}

export interface CreateEnum {
  readonly kind: "CreateEnum";
  readonly enum: string;
  readonly values: readonly string[];
  readonly source: StatementSource;
}

export interface DropEnum {
  readonly kind: "DropEnum";
  readonly enum: string;
  readonly source: StatementSource;
}

export interface AddEnumValue {
  readonly kind: "AddEnumValue";
  readonly enum: string;
  readonly value: string;
  readonly source: StatementSource;
}

export interface RenameEnum {
  readonly kind: "RenameEnum";
  readonly enum: string;
  readonly newName: string;
  readonly source: StatementSource;
}

export interface UpdateRows extends TableChange {
  readonly kind: "UpdateRows";
  /** The columns the UPDATE sets (RG-DB-018's backfill exception reads them). */
  readonly columns: readonly string[];
}

export interface DeleteRows extends TableChange {
  readonly kind: "DeleteRows";
  readonly via: "delete" | "truncate";
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
  | AddConstraint
  | DropConstraint
  | CreateUniqueIndex
  | CreateIndex
  | DropIndex
  | RenameIndex
  | CreateEnum
  | DropEnum
  | AddEnumValue
  | RenameEnum
  | UpdateRows
  | DeleteRows
  | Unrecognized;
