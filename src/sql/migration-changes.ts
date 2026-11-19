// Turns one new migration's SQL into its changes: Unparsable if Postgres rejects it, else the normalized statements.
import type { Change } from "../types.ts";
import { normalize } from "./normalize/normalize.ts";
import { parseSql } from "./parse.ts";

export async function migrationChanges(migration: string, sql: string): Promise<Change[]> {
  const parsed = await parseSql(sql);
  if (parsed.kind === "failure") {
    // The whole file is unreadable, so it gives exactly one change (D21, D28).
    const { message, line } = parsed;
    return [{ kind: "Unparsable", message, line, source: { kind: "migration", migration } }];
  }
  return normalize(migration, parsed.statements);
}
