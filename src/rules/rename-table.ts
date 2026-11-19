// RG-DB-003 · Rename table (RULES §4): renaming a table base uses → UNSAFE; otherwise a SAFE note.
import type { Entry, RenameTable } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { tableTarget } from "./target.ts";

export const RULE_ID = "RG-DB-003";

export function renameTable(change: RenameTable, { used }: RuleContext): Entry {
  const target = tableTarget(change.table);
  if (!used.tables.has(change.table)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use table "${change.table}", so renaming it can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target,
    reason: `Base queries table "${change.table}", which no longer exists after the rename to "${change.newName}".`,
    fix: `Keep the table name and rename only the model (@@map("${change.table}")), or do an expand/contract migration over several releases.`,
    source: change.source,
  };
}
