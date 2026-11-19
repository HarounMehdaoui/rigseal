// Follows a column added in this release through head's later changes to where it ends up (D33).
import type { AddColumn } from "../types.ts";
import type { RuleContext } from "./context.ts";

export interface ColumnEndState {
  /** False if a later change drops the column (or its table) again. */
  readonly exists: boolean;
  readonly notNull: boolean;
  readonly hasDefault: boolean;
}

/**
 * Only changes after `added` in the release count. Renames are followed, so a column that is added,
 * renamed and then has its default dropped is still tracked.
 */
export function columnEndState(added: AddColumn, context: RuleContext): ColumnEndState {
  let table = added.table;
  let column = added.column;
  let notNull = added.notNull;
  let hasDefault = added.hasDefault;

  const index = context.changes.indexOf(added);
  for (const change of index === -1 ? [] : context.changes.slice(index + 1)) {
    if (change.kind === "RenameTable" && change.table === table) table = change.newName;
    if (change.kind === "DropTable" && change.table === table) {
      return { exists: false, notNull, hasDefault };
    }
    if (!("column" in change) || change.table !== table || change.column !== column) continue;
    switch (change.kind) {
      case "RenameColumn":
        column = change.newName;
        break;
      case "DropColumn":
        return { exists: false, notNull, hasDefault };
      case "SetNotNull":
        notNull = true;
        break;
      case "DropNotNull":
        notNull = false;
        break;
      case "SetDefault":
        hasDefault = true;
        break;
      case "DropDefault":
        hasDefault = false;
        break;
      default:
        // A type change or a second ADD doesn't change nullability or the default.
        break;
    }
  }
  return { exists: true, notNull, hasDefault };
}
