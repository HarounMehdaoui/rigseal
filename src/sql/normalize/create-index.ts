// Turns CREATE [UNIQUE] INDEX into CreateUniqueIndex (with its columns) or CreateIndex.
import type { Change, StatementSource } from "../../types.ts";
import type { IndexStmt } from "../parse.ts";
import { fromRangeVar } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

export function createIndex(stmt: IndexStmt, source: StatementSource): Change {
  const ref = fromRangeVar(stmt.relation);
  if (!ref.ok) return unrecognized("IndexStmt", ref.reason, source);
  const name = stmt.idxname ?? null;
  if (stmt.unique !== true) return { kind: "CreateIndex", table: ref.name, name, source };

  const columns: string[] = [];
  let expressions = false;
  for (const param of stmt.indexParams ?? []) {
    const name = "IndexElem" in param ? param.IndexElem.name : undefined;
    if (name === undefined) expressions = true;
    else columns.push(name);
  }
  return { kind: "CreateUniqueIndex", table: ref.name, name, columns, expressions, source };
}
