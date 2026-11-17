// Turns UPDATE into UpdateRows with the columns it sets (RG-DB-018's backfill exception reads them).
import type { Change, StatementSource } from "../../types.ts";
import type { UpdateStmt } from "../parse.ts";
import { fromRangeVar } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

export function updateRows(stmt: UpdateStmt, source: StatementSource): Change {
  const ref = fromRangeVar(stmt.relation);
  if (!ref.ok) return unrecognized("UpdateStmt", ref.reason, source);
  const columns = (stmt.targetList ?? []).flatMap((t) =>
    "ResTarget" in t && t.ResTarget.name !== undefined ? [t.ResTarget.name] : [],
  );
  return { kind: "UpdateRows", table: ref.name, columns, source };
}
