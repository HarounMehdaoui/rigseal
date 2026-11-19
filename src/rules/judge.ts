// Sends each change to the rule that judges its kind; every change gets exactly one entry (D21, D28).
import type { Change, Entry } from "../types.ts";
import { alterColumnType } from "./alter-column-type.ts";
import { checkConstraint } from "./check-constraint.ts";
import type { RuleContext } from "./context.ts";
import { dropColumn } from "./drop-column.ts";
import { dropDefault } from "./drop-default.ts";
import { dropNotNull } from "./drop-not-null.ts";
import { dropTable } from "./drop-table.ts";
import { editedMigration } from "./edited-migration.ts";
import { enumRenamed } from "./enum-renamed.ts";
import { enumValueAdded } from "./enum-value-added.ts";
import { foreignKey } from "./foreign-key.ts";
import { harmlessChange } from "./harmless-change.ts";
import { renameColumn } from "./rename-column.ts";
import { renameTable } from "./rename-table.ts";
import { requiredColumnAdded } from "./required-column-added.ts";
import { rowsDeleted } from "./rows-deleted.ts";
import { rowsUpdated } from "./rows-updated.ts";
import { setNotNull } from "./set-not-null.ts";
import { uniqueConstraint } from "./unique-constraint.ts";
import { unparsable } from "./unparsable.ts";
import { unrecognizedStatement } from "./unrecognized-statement.ts";

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
    case "AddConstraint":
      if (change.constraint === "check") return checkConstraint(change, context);
      if (change.constraint === "foreignKey") return foreignKey(change, context);
      return uniqueConstraint(change, context);
    case "CreateUniqueIndex":
      return uniqueConstraint(change, context);
    case "AddEnumValue":
      return enumValueAdded(change, context);
    case "RenameEnum":
      return enumRenamed(change, context);
    case "UpdateRows":
      return rowsUpdated(change, context);
    case "DeleteRows":
      return rowsDeleted(change, context);
    case "Unrecognized":
      return unrecognizedStatement(change);
    case "CreateTable":
    case "CreateIndex":
    case "DropIndex":
    case "DropConstraint":
    case "RenameIndex":
    case "CreateEnum":
    case "DropEnum":
      return harmlessChange(change);
    default: {
      const missing: never = change;
      return missing;
    }
  }
}
