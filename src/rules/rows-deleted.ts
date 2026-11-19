// RG-DB-019 · Rows deleted (RULES §4): DELETE or TRUNCATE on a table base uses → RISKY.
import type { DeleteRows, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { tableTarget } from "./target.ts";

export const RULE_ID = "RG-DB-019";

export function rowsDeleted(change: DeleteRows, { used }: RuleContext): Entry {
  const target = tableTarget(change.table);
  const what = change.via === "delete" ? "DELETE" : "TRUNCATE";
  if (!used.tables.has(change.table)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use table "${change.table}", so a ${what} on it can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `The ${what} removes rows from "${change.table}", which base reads: base code that expects the deleted rows (lookups, seeds, references) fails or misbehaves.`,
    fix: "Soft-delete, or delete in a later release once base no longer reads those rows.",
    source: change.source,
  };
}
