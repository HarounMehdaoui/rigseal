// RG-DB-001 · Drop table (RULES §4): dropping a table base uses → UNSAFE; otherwise a SAFE note.
import type { DropTable, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { tableTarget } from "./target.ts";

export const RULE_ID = "RG-DB-001";

export function dropTable(change: DropTable, { used }: RuleContext): Entry {
  const target = tableTarget(change.table);
  if (!used.tables.has(change.table)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use table "${change.table}" (no model maps to it, or it's @@ignore), so dropping it can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target,
    reason: `Base uses table "${change.table}": every base query on this model fails with "relation does not exist".`,
    fix: "Remove the model from the code (or @@ignore it) in one release, and drop the table in the next one.",
    source: change.source,
  };
}
