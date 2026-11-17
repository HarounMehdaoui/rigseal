// Turns a hand-written RENAME of a table or column into RenameTable or RenameColumn.
import type { Change, StatementSource } from "../../types.ts";
import type { RenameStmt } from "../parse.ts";
import { fromRangeVar } from "./table-name.ts";
import { unrecognized } from "./unrecognized.ts";

const STATEMENT = "RenameStmt";

export function rename(stmt: RenameStmt, source: StatementSource): Change {
  const what = `${STATEMENT}/${stmt.renameType}`;
  const isTable = stmt.renameType === "OBJECT_TABLE";
  const isColumn = stmt.renameType === "OBJECT_COLUMN" && stmt.relationType === "OBJECT_TABLE";
  if (!isTable && !isColumn) return unrecognized(what, "no normalizer for this RENAME yet", source);

  const ref = fromRangeVar(stmt.relation);
  if (!ref.ok) return unrecognized(what, ref.reason, source);
  const newName = stmt.newname;
  if (newName === undefined) return unrecognized(what, "the new name could not be read", source);

  if (isTable) return { kind: "RenameTable", table: ref.table, newName, source };
  if (stmt.subname === undefined) return unrecognized(what, "the column could not be read", source);
  return { kind: "RenameColumn", table: ref.table, column: stmt.subname, newName, source };
}
