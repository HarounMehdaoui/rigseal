// Turns one migration's parsed statements into typed changes, one per action (T3.2).
import type { Change, StatementSource } from "../../types.ts";
import type { Node, Statement } from "../parse.ts";
import { alterTable } from "./alter-table.ts";
import { createTable } from "./create-table.ts";
import { drop } from "./drop.ts";
import { rename } from "./rename.ts";
import { unrecognized } from "./unrecognized.ts";

/** Every statement yields at least one change: a statement it doesn't model becomes Unrecognized. */
export function normalize(migration: string, statements: readonly Statement[]): Change[] {
  return statements.flatMap(({ node, line }) => {
    const at = (action: number): StatementSource => ({
      kind: "statement",
      migration,
      line,
      action,
    });
    if ("AlterTableStmt" in node) return alterTable(node.AlterTableStmt, at);
    if ("DropStmt" in node) return drop(node.DropStmt, at);
    if ("RenameStmt" in node) return [rename(node.RenameStmt, at(0))];
    if ("CreateStmt" in node) return [createTable(node.CreateStmt, at(0))];
    return [unrecognized(nodeKind(node), "no normalizer for this statement yet", at(0))];
  });
}

/** The node's single key, e.g. `ViewStmt`. */
function nodeKind(node: Node): string {
  return Object.keys(node)[0] ?? "unknown";
}
