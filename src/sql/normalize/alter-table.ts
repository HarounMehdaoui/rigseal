// Splits one ALTER TABLE into one change per action (`DROP x, ADD y` → actions 0 and 1).
import type { Change, StatementSource } from "../../types.ts";
import type { AlterTableCmd, AlterTableStmt } from "../parse.ts";
import { readColumnDef } from "./column-def.ts";
import { addConstraint } from "./constraint.ts";
import { fromRangeVar } from "./qualified-name.ts";
import { pgType } from "./type-name.ts";
import { unrecognized } from "./unrecognized.ts";

const STATEMENT = "AlterTableStmt";

export function alterTable(
  stmt: AlterTableStmt,
  at: (action: number) => StatementSource,
): Change[] {
  // ALTER INDEX / SEQUENCE / VIEW / TYPE share this node; only tables are modelled here.
  if (stmt.objtype !== "OBJECT_TABLE") {
    return [unrecognized(`${STATEMENT}/${stmt.objtype}`, "not a table", at(0))];
  }
  const ref = fromRangeVar(stmt.relation);
  if (!ref.ok) return [unrecognized(STATEMENT, ref.reason, at(0))];

  return (stmt.cmds ?? []).map((node, action) =>
    "AlterTableCmd" in node
      ? command(ref.name, node.AlterTableCmd, at(action))
      : unrecognized(STATEMENT, "an action the parser didn't label", at(action)),
  );
}

function command(table: string, cmd: AlterTableCmd, source: StatementSource): Change {
  const what = `${STATEMENT}/${cmd.subtype}`;
  const def = cmd.def;

  if (cmd.subtype === "AT_AddColumn") {
    const shape =
      def !== undefined && "ColumnDef" in def ? readColumnDef(def.ColumnDef) : undefined;
    if (shape === undefined)
      return unrecognized(what, "the column definition could not be read", source);
    return { kind: "AddColumn", table, ...shape, source };
  }

  if (cmd.subtype === "AT_AddConstraint") {
    if (def === undefined || !("Constraint" in def)) {
      return unrecognized(what, "the constraint could not be read", source);
    }
    return addConstraint(table, def.Constraint, source);
  }

  // DROP CONSTRAINT names the constraint; the column actions below name a column.
  const name = cmd.name;
  if (name === undefined)
    return unrecognized(what, "the action names no column or constraint", source);
  if (cmd.subtype === "AT_DropConstraint") return { kind: "DropConstraint", table, name, source };
  const column = name;

  switch (cmd.subtype) {
    case "AT_DropColumn":
      return { kind: "DropColumn", table, column, source };
    case "AT_AlterColumnType": {
      const columnDef = def !== undefined && "ColumnDef" in def ? def.ColumnDef : undefined;
      if (columnDef?.typeName === undefined) {
        return unrecognized(what, "the new type could not be read", source);
      }
      const type = pgType(columnDef.typeName);
      return {
        kind: "AlterColumnType",
        table,
        column,
        type,
        using: columnDef.raw_default !== undefined,
        source,
      };
    }
    case "AT_SetNotNull":
      return { kind: "SetNotNull", table, column, source };
    case "AT_DropNotNull":
      return { kind: "DropNotNull", table, column, source };
    case "AT_ColumnDefault":
      // The same action sets or drops a default: no expression means DROP DEFAULT.
      return { kind: def === undefined ? "DropDefault" : "SetDefault", table, column, source };
    default:
      return unrecognized(what, "no normalizer for this ALTER TABLE action yet", source);
  }
}
