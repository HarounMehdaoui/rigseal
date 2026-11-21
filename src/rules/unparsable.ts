// RG-DB-021 · Unparsable SQL: a migration Postgres's parser rejects → UNSAFE.
// UNSAFE, not RISKY: the tool can't tell what the migration does to base, so it fails closed.
import type { Entry, Unparsable } from "../types.ts";

export const RULE_ID = "RG-DB-021";

export function unparsable(change: Unparsable): Entry {
  const where = change.line === null ? "" : ` at line ${change.line}`;
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target: change.source.migration,
    reason: `Postgres's parser rejects this migration${where}: "${change.message}". Rigseal can't tell what it does to base.`,
    fix: "Fix the SQL so Postgres's own parser accepts it.",
    source: change.source,
  };
}
