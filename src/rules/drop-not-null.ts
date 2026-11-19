// RG-DB-010 · Drop NOT NULL (RULES §4): on a column base has as required → RISKY; otherwise a SAFE note.
import type { DropNotNull, Entry } from "../types.ts";
import { addedInRelease } from "./added-in-release.ts";
import type { RuleContext } from "./context.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-010";

export function dropNotNull(change: DropNotNull, context: RuleContext): Entry {
  const name = `"${change.table}"."${change.column}"`;
  const base = {
    ruleId: RULE_ID,
    target: columnTarget(change.table, change.column),
    source: change.source,
  };
  const note = (reason: string): Entry => ({ ...base, severity: "SAFE", reason });

  if (addedInRelease(change.table, change.column, context)) {
    return note(
      `Column ${name} is added in this release, so RG-DB-005 judges where it ends up (D33).`,
    );
  }
  const column = context.used.tables.get(change.table)?.columns.get(change.column);
  if (column === undefined)
    return note(`Base doesn't use column ${name}, so allowing NULL in it can't break base.`);
  if (column.optional)
    return note(`Base's field for ${name} is already optional, so base handles NULL there.`);
  return {
    ...base,
    severity: "RISKY",
    reason: `Base's field for ${name} is required: if head writes NULL here, base reads it without any error, because Prisma returns null for a field its TypeScript type says is never null, and base breaks later wherever it uses the value.`,
    fix: "Keep writing the column in this release, and stop writing it one release later (RULES §5).",
  };
}
