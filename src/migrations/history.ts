// Base's migration folders vs head's: which are new, unchanged, modified or removed (D9, D18, D19).
import { createHash } from "node:crypto";
import type { EditedMigration } from "../types.ts";

/** One migration folder as read at a ref: its name and its `migration.sql`. */
export interface MigrationFolder {
  readonly name: string;
  readonly sql: string;
}

export type MigrationStatus = "new" | "unchanged" | "modified" | "removed";

export interface HistoryEntry {
  readonly name: string;
  readonly status: MigrationStatus;
  /** Fingerprint in base, `null` if the migration is new. */
  readonly base: string | null;
  /** Fingerprint in head, `null` if the migration was removed. */
  readonly head: string | null;
}

/**
 * SHA-256 (hex) of the SQL after CRLF → LF (D19). That's Prisma's own checksum, so a Windows
 * checkout that only changed line endings isn't an edit (RULES §6 row 12).
 */
export function fingerprint(sql: string): string {
  return createHash("sha256").update(sql.replaceAll("\r\n", "\n"), "utf8").digest("hex");
}

/** Every folder in base or head, once, sorted by name: the order Prisma applies them in. */
export function diffHistory(
  base: readonly MigrationFolder[],
  head: readonly MigrationFolder[],
): HistoryEntry[] {
  const baseHashes = fingerprints(base);
  const headHashes = fingerprints(head);
  const names = [...new Set([...baseHashes.keys(), ...headHashes.keys()])].sort(byCodeUnit);

  return names.map((name) => {
    const b = baseHashes.get(name) ?? null;
    const h = headHashes.get(name) ?? null;
    return { name, status: status(b, h), base: b, head: h };
  });
}

/** The history entries RG-DB-020 judges: released migrations that head edited or deleted. */
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

function fingerprints(folders: readonly MigrationFolder[]): Map<string, string> {
  return new Map(folders.map((f) => [f.name, fingerprint(f.sql)]));
}

function status(base: string | null, head: string | null): MigrationStatus {
  if (base === null) return "new";
  if (head === null) return "removed";
  return base === head ? "unchanged" : "modified";
}

/** Plain code-unit order, never `localeCompare`: the result must not depend on the machine's locale. */
function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
