// RG-DB-004 · Rename column: renaming a column base uses → UNSAFE; otherwise a SAFE note.
import type { Entry, RenameColumn } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-004";

export function renameColumn(change: RenameColumn, { used }: RuleContext): Entry {
  const target = columnTarget(change.table, change.column);
  const name = `"${change.table}"."${change.column}"`;
  if (used.tables.get(change.table)?.columns.has(change.column) !== true) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use column ${name}, so renaming it can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target,
    reason: `Base selects column ${name}, which no longer exists after the rename to "${change.newName}", so every query on the model fails (as with RG-DB-002).`,
    fix: `Keep the column name and rename only the field (@map("${change.column}")), or follow the four-release rename.`,
    source: change.source,
  };
}
