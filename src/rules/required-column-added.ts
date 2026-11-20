// RG-DB-005 · Required column added: ends NOT NULL with no default on a used table → UNSAFE.
import type { AddColumn, Entry } from "../types.ts";
import { columnEndState } from "./column-end-state.ts";
import type { RuleContext } from "./context.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-005";

/** Judged by the column's end state after the whole release, not by the ADD alone. */
export function requiredColumnAdded(change: AddColumn, context: RuleContext): Entry {
  const target = columnTarget(change.table, change.column);
  const name = `"${change.table}"."${change.column}"`;
  const note = (why: string): Entry => ({
    ruleId: RULE_ID,
    severity: "SAFE",
    target,
    reason: `Column ${name} ${why}, so base's inserts, which never send it, still succeed.`,
    source: change.source,
  });

  if (!context.used.tables.has(change.table))
    return note(`is added to table "${change.table}", which base doesn't use`);
  const end = columnEndState(change, context);
  if (!end.exists) return note("is dropped again later in this release");
  if (!end.notNull) return note("ends nullable");
  if (end.hasDefault) return note("ends with a database default");
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target,
    reason: `Column ${name} ends NOT NULL with no database default, and base doesn't know it: every base insert into "${change.table}" fails with a NOT NULL violation.`,
    fix: "Add the column as nullable or with a default, and tighten it in a later release.",
    source: change.source,
  };
}
