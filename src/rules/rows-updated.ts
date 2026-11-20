// RG-DB-018 · Rows updated: an UPDATE that sets a column base uses → RISKY; a backfill is SAFE.
import type { Entry, UpdateRows } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { tableTarget } from "./target.ts";

export const RULE_ID = "RG-DB-018";

/**
 * The backfill exception falls out of the condition: columns added in this release, and `@ignore`
 * columns, are never in base's used set.
 */
export function rowsUpdated(change: UpdateRows, { used }: RuleContext): Entry {
  const target = tableTarget(change.table);
  const table = used.tables.get(change.table);
  const usedColumns = change.columns.filter((c) => table?.columns.has(c) === true);
  if (usedColumns.length === 0) {
    const set = change.columns.map((c) => `"${c}"`).join(", ");
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `The UPDATE sets only ${set}, which base doesn't use (a backfill of a column added in this release, an @ignore column, or a table base doesn't know), so base never reads the rewritten values.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `The UPDATE rewrites ${usedColumns.map((c) => `"${c}"`).join(", ")}, which base reads: base may interpret the rewritten values wrongly (format, units or meaning).`,
    fix: "Write transformed data to a new column (expand/contract) instead of rewriting a column base reads.",
    source: change.source,
  };
}
