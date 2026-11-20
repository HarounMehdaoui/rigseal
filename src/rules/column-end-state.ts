// Follows a column through a release's changes (renames, NOT NULL, defaults, drops) to where it ends up.
import type { AddColumn, Change } from "../types.ts";
import type { RuleContext } from "./context.ts";

export interface ColumnEndState {
  /** False if a later change drops the column (or its table) again. */
  readonly exists: boolean;
  readonly notNull: boolean;
  readonly hasDefault: boolean;
}

/** Where a column starts: as added, or as base's schema has it. */
export interface ColumnStart {
  readonly table: string;
  readonly column: string;
  readonly notNull: boolean;
  readonly hasDefault: boolean;
}

/** A column added in this release: only the changes after the ADD count. */
export function columnEndState(added: AddColumn, context: RuleContext): ColumnEndState {
  const index = context.changes.indexOf(added);
  return followColumn(added, index === -1 ? [] : context.changes.slice(index + 1));
}

/**
 * Applies `changes` in order. Renames are followed, so a column that is renamed and then has its
 * default dropped is still tracked.
 */
export function followColumn(start: ColumnStart, changes: readonly Change[]): ColumnEndState {
  let table = start.table;
  let column = start.column;
  let notNull = start.notNull;
  let hasDefault = start.hasDefault;

  for (const change of changes) {
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
