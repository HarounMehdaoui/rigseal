// RG-DB-012 · New unique constraint or primary key: on a column base uses → RISKY.
import type { AddConstraint, CreateUniqueIndex, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { objectTarget } from "./target.ts";

export const RULE_ID = "RG-DB-012";

export function uniqueConstraint(
  change: CreateUniqueIndex | AddConstraint,
  { used }: RuleContext,
): Entry {
  const target = objectTarget(change.name, change.table);
  const table = used.tables.get(change.table);
  const usedColumns = change.columns.filter((c) => table?.columns.has(c) === true);
  // An expression (or USING INDEX) hides which columns are in the key: on a used table, assume one is.
  const hidden =
    change.kind === "CreateUniqueIndex" ? change.expressions : change.columns.length === 0;
  if (table === undefined || (usedColumns.length === 0 && !hidden)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `No column of the new unique key on "${change.table}" is used by base, so base never writes a duplicate into it.`,
      source: change.source,
    };
  }
  const which =
    usedColumns.length > 0 ? usedColumns.map((c) => `"${c}"`).join(", ") : "columns base may use";
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `Base writes ${which} on "${change.table}": base writes that create a duplicate value now fail with a unique violation.`,
    fix: "Add @unique to the code (and handle the conflict) one release before adding the index.",
    source: change.source,
  };
}
