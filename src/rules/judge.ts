// Sends each change to the rule that judges its kind; every change gets exactly one entry (D21, D28).
import type { Change, Entry } from "../types.ts";
import { alterColumnType } from "./alter-column-type.ts";
import type { RuleContext } from "./context.ts";
import { dropColumn } from "./drop-column.ts";
import { dropDefault } from "./drop-default.ts";
import { dropNotNull } from "./drop-not-null.ts";
import { dropTable } from "./drop-table.ts";
import { editedMigration } from "./edited-migration.ts";
import { harmlessChange } from "./harmless-change.ts";
import { renameColumn } from "./rename-column.ts";
import { renameTable } from "./rename-table.ts";
import { requiredColumnAdded } from "./required-column-added.ts";
import { setNotNull } from "./set-not-null.ts";
import { unparsable } from "./unparsable.ts";

/** The `switch` is exhaustive: a new Change kind without a case here fails to compile. */
export function judge(change: Change, context: RuleContext): Entry {
  switch (change.kind) {
    case "EditedMigration":
      return editedMigration(change);
    case "Unparsable":
      return unparsable(change);
    case "DropTable":
      return dropTable(change, context);
    case "DropColumn":
      return dropColumn(change, context);
    case "RenameTable":
      return renameTable(change, context);
    case "RenameColumn":
      return renameColumn(change, context);
    case "AddColumn":
      return requiredColumnAdded(change, context);
    case "AlterColumnType":
      return alterColumnType(change, context);
    case "SetNotNull":
      return setNotNull(change, context);
    case "DropNotNull":
      return dropNotNull(change, context);
    case "DropDefault":
      return dropDefault(change, context);
    case "SetDefault":
      return harmlessChange(change);
    // Rules still to come: T5.1 (constraints, enums, data, Unrecognized), and RG-DB-000 notes for kinds with no rule.
    case "CreateTable":
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
