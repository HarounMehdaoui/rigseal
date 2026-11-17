// Produces RG-DB-020's input: one EditedMigration change per released migration head edited or deleted.
import type { EditedMigration } from "../types.ts";
import type { HistoryEntry } from "./history.ts";

/** Released migrations that head edited or deleted; new and unchanged ones are skipped. */
export function editedMigrations(history: readonly HistoryEntry[]): EditedMigration[] {
  const edited: EditedMigration[] = [];
  for (const entry of history) {
    if (entry.status === "modified" || entry.status === "removed") {
      edited.push({
        kind: "EditedMigration",
        edit: entry.status,
        source: { kind: "migration", migration: entry.name },
      });
    }
  }
  return edited;
}
