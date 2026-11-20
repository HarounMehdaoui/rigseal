// The skip list: statements that change nothing base could notice, so they give no change.
import type { Node } from "../parse.ts";

/** BEGIN / START TRANSACTION / COMMIT, and Prisma's `CREATE SCHEMA IF NOT EXISTS "public"`. */
export function isSkipped(node: Node): boolean {
  if ("TransactionStmt" in node) {
    const kind = node.TransactionStmt.kind;
    return (
      kind === "TRANS_STMT_BEGIN" || kind === "TRANS_STMT_START" || kind === "TRANS_STMT_COMMIT"
    );
  }
  if ("CreateSchemaStmt" in node) {
    const stmt = node.CreateSchemaStmt;
    return (
      stmt.schemaname === "public" && stmt.if_not_exists === true && stmt.schemaElts === undefined
    );
  }
  return false;
}
