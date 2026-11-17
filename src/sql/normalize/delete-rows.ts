// Turns DELETE and TRUNCATE into DeleteRows, one per table (`TRUNCATE a, b` → actions 0 and 1).
import type { Change, StatementSource } from "../../types.ts";
import type { DeleteStmt, TruncateStmt } from "../parse.ts";
import { fromRangeVar } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

export function deleteRows(stmt: DeleteStmt, source: StatementSource): Change {
  const ref = fromRangeVar(stmt.relation);
  return ref.ok
    ? { kind: "DeleteRows", table: ref.name, via: "delete", source }
    : unrecognized("DeleteStmt", ref.reason, source);
}

export function truncateRows(
  stmt: TruncateStmt,
  at: (action: number) => StatementSource,
): Change[] {
  return (stmt.relations ?? []).map((node, action) => {
    const ref = fromRangeVar("RangeVar" in node ? node.RangeVar : undefined);
    return ref.ok
      ? { kind: "DeleteRows", table: ref.name, via: "truncate", source: at(action) }
      : unrecognized("TruncateStmt", ref.reason, at(action));
  });
}
