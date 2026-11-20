// Turns one migration's parsed statements into typed changes, one per action.
import type { Change, StatementSource } from "../../types.ts";
import type { Node, Statement } from "../parse.ts";
import { alterEnum } from "./alter-enum.ts";
import { alterTable } from "./alter-table.ts";
import { createEnum } from "./create-enum.ts";
import { createIndex } from "./create-index.ts";
import { createTable } from "./create-table.ts";
import { deleteRows, truncateRows } from "./delete-rows.ts";
import { drop } from "./drop.ts";
import { rename } from "./rename.ts";
import { isSkipped } from "./skip-list.ts";
import { unrecognized } from "./unrecognized.ts";
import { updateRows } from "./update-rows.ts";

export function normalize(migration: string, statements: readonly Statement[]): Change[] {
  return statements.flatMap((statement) => normalizeStatement(migration, statement));
}

/**
 * One statement's changes. Empty only for a skip-listed statement; anything not modelled becomes
 * Unrecognized, so no statement is ever dropped silently.
 */
export function normalizeStatement(migration: string, { node, line }: Statement): Change[] {
  if (isSkipped(node)) return [];
  const at = (action: number): StatementSource => ({ kind: "statement", migration, line, action });
  if ("AlterTableStmt" in node) return alterTable(node.AlterTableStmt, at);
  if ("DropStmt" in node) return drop(node.DropStmt, at);
  if ("TruncateStmt" in node) return truncateRows(node.TruncateStmt, at);
  if ("RenameStmt" in node) return [rename(node.RenameStmt, at(0))];
  if ("CreateStmt" in node) return [createTable(node.CreateStmt, at(0))];
  if ("IndexStmt" in node) return [createIndex(node.IndexStmt, at(0))];
  if ("CreateEnumStmt" in node) return [createEnum(node.CreateEnumStmt, at(0))];
  if ("AlterEnumStmt" in node) return [alterEnum(node.AlterEnumStmt, at(0))];
  if ("UpdateStmt" in node) return [updateRows(node.UpdateStmt, at(0))];
  if ("DeleteStmt" in node) return [deleteRows(node.DeleteStmt, at(0))];
  return [unrecognized(nodeKind(node), "no normalizer for this statement yet", at(0))];
}

/** The node's single key, e.g. `ViewStmt`. */
function nodeKind(node: Node): string {
  return Object.keys(node)[0] ?? "unknown";
}
