// RG-DB-011 · Drop default (RULES §4): a default the database applies for base → UNSAFE (NOT NULL) or RISKY.
import type { DropDefault, Entry } from "../types.ts";
import { addedInRelease } from "./added-in-release.ts";
import { followColumn } from "./column-end-state.ts";
import type { RuleContext } from "./context.ts";
import { columnTarget } from "./target.ts";

export const RULE_ID = "RG-DB-011";

/**
 * Only `autoincrement()` and `dbgenerated()` are filled by the database; Prisma sends every other
 * default itself (RULES §6 row 5). NOT NULL is judged after the whole release, as head leaves it.
 */
export function dropDefault(change: DropDefault, context: RuleContext): Entry {
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
    return note(`Base doesn't use column ${name}, so dropping its default can't break base.`);
  if (column.default === null)
    return note(
      `Base's field for ${name} has no @default, so base never relies on a database default.`,
    );
  const fn = column.default.kind === "literal" ? "a literal" : `${column.default.kind}()`;
  if (column.default.appliedBy === "prisma") {
    return note(
      `Base's @default for ${name} is ${fn}, which Prisma sends itself, so base's inserts don't use the database default.`,
    );
  }

  const start = {
    table: change.table,
    column: change.column,
    notNull: !column.optional,
    hasDefault: true,
  };
  const end = followColumn(start, context.changes);
  const fix =
    "Keep the default until base no longer relies on it (base sets the value itself), then drop it one release later.";
  if (end.notNull) {
    return {
      ...base,
      severity: "UNSAFE",
      reason: `Base relies on the database to fill ${name} (${fn}) and never sends it: every base insert now fails with a NOT NULL violation.`,
      fix,
    };
  }
  return {
    ...base,
    severity: "RISKY",
    reason: `Base relies on the database to fill ${name} (${fn}) and never sends it: base's inserts now store NULL instead, and base breaks wherever it depends on that value.`,
    fix,
  };
}
