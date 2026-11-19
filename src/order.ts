// The entry order for JSON (D24, D29): by file, line, rule ID, target, action; whole-migration entries at line 0.
import { byCodeUnit } from "./compare.ts";
import type { Entry } from "./types.ts";

/**
 * Every migration's file is `<migrations dir>/<name>/migration.sql`, so the migration name orders
 * the files. Code-unit order, never the locale, so the bytes are the same on every machine (D24).
 * Stable, so exact duplicates keep their place (D29 keeps duplicates).
 */
export function sortEntries(entries: readonly Entry[]): Entry[] {
  return [...entries].sort(compareEntries);
}

function compareEntries(a: Entry, b: Entry): number {
  return (
    byCodeUnit(a.source.migration, b.source.migration) ||
    line(a) - line(b) ||
    byCodeUnit(a.ruleId, b.ruleId) ||
    byCodeUnit(a.target, b.target) ||
    action(a) - action(b)
  );
}

function line(entry: Entry): number {
  return entry.source.kind === "statement" ? entry.source.line : 0;
}

function action(entry: Entry): number {
  return entry.source.kind === "statement" ? entry.source.action : 0;
}
