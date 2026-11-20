// The pure core: base and head snapshots → one entry per change in D29 order, plus the history and used set they came from.
import { editedMigrations } from "./migrations/edited-migrations.ts";
import { diffHistory, type HistoryEntry } from "./migrations/history.ts";
import { sortEntries } from "./order.ts";
import { judge } from "./rules/judge.ts";
import type { UsedSet } from "./schema/types.ts";
import { buildUsedSet } from "./schema/used-set.ts";
import { migrationChanges } from "./sql/migration-changes.ts";
import { recognizeEnumRecreate } from "./sql/normalize/enum-recreate.ts";
import type { Change, Entry, Snapshot } from "./types.ts";

/** The entries, plus what the report states besides them: the history and base's used set (D24, D37). */
export interface Analysis {
  readonly entries: readonly Entry[];
  readonly history: readonly HistoryEntry[];
  readonly used: UsedSet;
}

/**
 * Base's schema says what base uses; head's history says what changed. Released migrations are
 * never re-parsed (an edit is RG-DB-020); only head's new ones are, in the order Prisma applies them.
 */
export async function analyze(base: Snapshot, head: Snapshot): Promise<Analysis> {
  const used = buildUsedSet(base.schema);
  const history = diffHistory(base.migrations, head.migrations);
  const headSql = new Map(head.migrations.map((m) => [m.name, m.sql]));

  const changes: Change[] = [...editedMigrations(history)];
  for (const entry of history) {
    if (entry.status !== "new") continue;
    const sql = headSql.get(entry.name);
    if (sql === undefined) throw new Error(`migration ${entry.name} is new but missing from head`);
    // Prisma's enum recreate spans statements; base's enum values say which ones it removes.
    const own = await migrationChanges(entry.name, sql);
    changes.push(...recognizeEnumRecreate(own, used));
  }

  const context = { used, changes };
  return { entries: sortEntries(changes.map((change) => judge(change, context))), history, used };
}
