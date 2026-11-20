// RG-DB-014 · New foreign key: on a table base uses → RISKY.
import type { AddConstraint, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { objectTarget } from "./target.ts";

export const RULE_ID = "RG-DB-014";

export function foreignKey(change: AddConstraint, { used }: RuleContext): Entry {
  const target = objectTarget(change.name, change.table);
  if (!used.tables.has(change.table)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use table "${change.table}", so a new foreign key on it can't reject base's writes.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `Base writes to "${change.table}": base inserts with a missing parent, or deletes of a referenced parent, now fail.`,
    fix: "Add the relation to the schema and make the code respect it one release before adding the foreign key.",
    source: change.source,
  };
}
