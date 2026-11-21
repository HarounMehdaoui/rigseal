// RG-DB-022 · Unrecognized statement: parsed but not modelled → RISKY, always (fail-closed).
import type { Entry, Unrecognized } from "../types.ts";

export const RULE_ID = "RG-DB-022";

/** Never SAFE about something unread, never UNSAFE over the tool's own blind spot. */
export function unrecognizedStatement(change: Unrecognized): Entry {
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target: change.statement,
    reason: `Rigseal understands the syntax of this ${change.statement} but doesn't model its effect on base (${change.reason}).`,
    fix: "Check the statement by hand. If it is common, open an issue to add a normalizer.",
    source: change.source,
  };
}
