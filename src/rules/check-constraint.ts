// RG-DB-013 · New CHECK constraint: on a table base uses → RISKY.
import type { AddConstraint, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { objectTarget } from "./target.ts";

export const RULE_ID = "RG-DB-013";

/** The CHECK expression isn't analysed: any CHECK on a used table counts. */
export function checkConstraint(change: AddConstraint, { used }: RuleContext): Entry {
  const target = objectTarget(change.name, change.table);
  if (!used.tables.has(change.table)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use table "${change.table}", so a new CHECK on it can't reject base's writes.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `Base writes to "${change.table}": base writes that violate the CHECK now fail.`,
    fix: "Enforce the same condition in code one release before adding the constraint, or add it NOT VALID and validate it later (that protects existing rows only).",
    source: change.source,
  };
}
