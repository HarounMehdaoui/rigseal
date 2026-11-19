// Renders any change as one short line, e.g. `DROP COLUMN "User"."name"`, for notes and messages.
import type { Change, PgType } from "./types.ts";

/** The `switch` is exhaustive: a new Change kind without a case here fails to compile. */
export function describeChange(change: Change): string {
  switch (change.kind) {
    case "EditedMigration":
      return `migration ${change.source.migration} ${change.edit}`;
    case "Unparsable":
      return `migration ${change.source.migration} does not parse`;
    case "CreateTable":
      return `CREATE TABLE "${change.table}"`;
    case "DropTable":
      return `DROP TABLE "${change.table}"`;
    case "RenameTable":
      return `RENAME TABLE "${change.table}" TO "${change.newName}"`;
    case "AddColumn": {
      const notNull = change.notNull ? " NOT NULL" : "";
      const dflt = change.hasDefault ? " DEFAULT …" : "";
      return `ADD COLUMN ${column(change)} ${formatType(change.type)}${notNull}${dflt}`;
    }
    case "DropColumn":
      return `DROP COLUMN ${column(change)}`;
    case "RenameColumn":
      return `RENAME COLUMN ${column(change)} TO "${change.newName}"`;
    case "AlterColumnType":
      return `ALTER COLUMN ${column(change)} TYPE ${formatType(change.type)}${change.using ? " USING …" : ""}`;
    case "SetNotNull":
      return `SET NOT NULL ${column(change)}`;
    case "DropNotNull":
      return `DROP NOT NULL ${column(change)}`;
    case "SetDefault":
      return `SET DEFAULT ${column(change)}`;
    case "DropDefault":
      return `DROP DEFAULT ${column(change)}`;
    case "AddConstraint": {
      const name = change.name === null ? "" : ` "${change.name}"`;
      const columns = change.columns.length > 0 ? ` (${quoted(change.columns)})` : "";
      return `ADD CONSTRAINT${name} ${CONSTRAINT_WORDS[change.constraint]} ON "${change.table}"${columns}`;
    }
    case "DropConstraint":
      return `DROP CONSTRAINT "${change.name}" ON "${change.table}"`;
    case "CreateUniqueIndex": {
      const name = change.name === null ? "" : ` "${change.name}"`;
      const parts = [...change.columns.map((c) => `"${c}"`), ...(change.expressions ? ["…"] : [])];
      return `CREATE UNIQUE INDEX${name} ON "${change.table}" (${parts.join(", ")})`;
    }
    case "CreateIndex":
      return `CREATE INDEX${change.name === null ? "" : ` "${change.name}"`} ON "${change.table}"`;
    case "DropIndex":
      return `DROP INDEX "${change.name}"`;
    case "RenameIndex":
      return `RENAME INDEX "${change.name}" TO "${change.newName}"`;
    case "CreateEnum":
      return `CREATE ENUM "${change.enum}" (${change.values.map((v) => `'${v}'`).join(", ")})`;
    case "DropEnum":
      return `DROP ENUM "${change.enum}"`;
    case "AddEnumValue":
      return `ADD VALUE '${change.value}' TO ENUM "${change.enum}"`;
    case "RemoveEnumValue":
      return `REMOVE VALUE '${change.value}' FROM ENUM "${change.enum}"`;
    case "RenameEnum":
      return `RENAME ENUM "${change.enum}" TO "${change.newName}"`;
    case "UpdateRows":
      return `UPDATE "${change.table}" SET ${quoted(change.columns)}`;
    case "DeleteRows":
      return change.via === "delete"
        ? `DELETE FROM "${change.table}"`
        : `TRUNCATE "${change.table}"`;
    case "Unrecognized":
      return `unrecognized ${change.statement}`;
    default: {
      const missing: never = change;
      return missing;
    }
  }
}

const CONSTRAINT_WORDS = {
  unique: "UNIQUE",
  primaryKey: "PRIMARY KEY",
  check: "CHECK",
  foreignKey: "FOREIGN KEY",
} as const;

function quoted(names: readonly string[]): string {
  return names.map((n) => `"${n}"`).join(", ");
}

function column(change: { readonly table: string; readonly column: string }): string {
  return `"${change.table}"."${change.column}"`;
}

function formatType(type: PgType): string {
  const args = type.args.length > 0 ? `(${type.args.join(",")})` : "";
  return `${type.name}${args}${type.array ? "[]" : ""}`;
}
