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
    case "Unrecognized":
      return `unrecognized ${change.statement}`;
    default: {
      const missing: never = change;
      return missing;
    }
  }
}

function column(change: { readonly table: string; readonly column: string }): string {
  return `"${change.table}"."${change.column}"`;
}

function formatType(type: PgType): string {
  const args = type.args.length > 0 ? `(${type.args.join(",")})` : "";
  return `${type.name}${args}${type.array ? "[]" : ""}`;
}
