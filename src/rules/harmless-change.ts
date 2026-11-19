// RG-DB-000 (D40): the SAFE note for a recognized change no rule judges (RULES §4's no-rule table).
import type { Entry, SetDefault } from "../types.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-000";

/** T5.1 adds the other no-rule kinds (CREATE TABLE, CREATE INDEX, RENAME INDEX, CREATE/DROP ENUM). */
export function harmlessChange(change: SetDefault): Entry {
  return {
    ruleId: RULE_ID,
    severity: "SAFE",
    target: columnTarget(change.table, change.column),
    reason: `Setting a default on "${change.table}"."${change.column}" can't break base: base's inserts still succeed.`,
    source: change.source,
  };
}
