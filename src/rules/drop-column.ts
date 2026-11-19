// RG-DB-002 · Drop column (RULES §4): dropping a column base uses → UNSAFE; otherwise a SAFE note.
import type { DropColumn, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-002";

export function dropColumn(change: DropColumn, { used }: RuleContext): Entry {
  const target = columnTarget(change.table, change.column);
  const name = `"${change.table}"."${change.column}"`;
  if (used.tables.get(change.table)?.columns.has(change.column) !== true) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use column ${name} (it's @ignore, added in this release, or unknown to base), so dropping it can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target,
    reason: `Base uses column ${name}: by default base's Prisma client selects every scalar column of a model, so every query on the model fails, not only the ones that use this field.`,
    fix: "Retire the field first (@ignore it and stop writing it; make it nullable if it is required), then drop it one release later.",
    source: change.source,
  };
}
