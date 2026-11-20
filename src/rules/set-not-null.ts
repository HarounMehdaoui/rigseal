// RG-DB-009 · Set NOT NULL: on a column base leaves optional → RISKY; otherwise a SAFE note.
import type { Entry, SetNotNull } from "../types.ts";
import { addedInRelease } from "./added-in-release.ts";
import type { RuleContext } from "./context.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-009";

export function setNotNull(change: SetNotNull, context: RuleContext): Entry {
  const name = `"${change.table}"."${change.column}"`;
  const base = {
    ruleId: RULE_ID,
    target: columnTarget(change.table, change.column),
    source: change.source,
  };
  const note = (reason: string): Entry => ({ ...base, severity: "SAFE", reason });

  if (addedInRelease(change.table, change.column, context)) {
    return note(`Column ${name} is added in this release, so RG-DB-005 judges where it ends up.`);
  }
  const column = context.used.tables.get(change.table)?.columns.get(change.column);
  if (column === undefined)
    return note(`Base doesn't use column ${name}, so making it NOT NULL can't break base.`);
  if (!column.optional)
    return note(
      `Base's field for ${name} is already required, so base's client never sends NULL for it.`,
    );
  return {
    ...base,
    severity: "RISKY",
    reason: `Base's field for ${name} is optional: base inserts or updates that leave it empty fail with a NOT NULL violation.`,
    fix: "Make sure base always writes the field before setting NOT NULL, or keep the column nullable.",
  };
}
