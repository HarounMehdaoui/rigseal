// Sends each change to the rule that judges its kind; every change gets exactly one entry (D21, D28).
import type { UsedSet } from "../schema/types.ts";
import type { Change, Entry } from "../types.ts";
import { editedMigration } from "./edited-migration.ts";
import { unparsable } from "./unparsable.ts";

/** What a rule may look at besides the change itself. */
export interface RuleContext {
  /** What base's client uses (RULES §2). */
  readonly used: UsedSet;
  /** Every change head's new migrations make, in order: RG-DB-005 judges a column's end state (D33). */
  readonly changes: readonly Change[];
}

/** The `switch` is exhaustive: a new Change kind without a case here fails to compile. */
export function judge(change: Change, _context: RuleContext): Entry {
  switch (change.kind) {
    case "EditedMigration":
      return editedMigration(change);
    case "Unparsable":
      return unparsable(change);
    // Rules still to come: T4.2 (tables, columns), T4.3 (types), T4.4 (nullability, defaults),
    // T5.1 (constraints, enums, data, Unrecognized), and RG-DB-000 notes for kinds with no rule.
    case "CreateTable":
    case "DropTable":
    case "RenameTable":
    case "AddColumn":
    case "DropColumn":
    case "RenameColumn":
    case "AlterColumnType":
    case "SetNotNull":
    case "DropNotNull":
    case "SetDefault":
    case "DropDefault":
    case "AddConstraint":
    case "DropConstraint":
    case "CreateUniqueIndex":
    case "CreateIndex":
    case "DropIndex":
    case "RenameIndex":
    case "CreateEnum":
    case "DropEnum":
    case "AddEnumValue":
    case "RenameEnum":
    case "UpdateRows":
    case "DeleteRows":
    case "Unrecognized":
      throw new Error(`no rule for ${change.kind} yet`);
    default: {
      const missing: never = change;
      return missing;
    }
  }
}
