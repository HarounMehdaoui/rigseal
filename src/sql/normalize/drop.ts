// Turns DROP TABLE into one DropTable per table it names (`DROP TABLE a, b` → actions 0 and 1).
import type { Change, StatementSource } from "../../types.ts";
import type { DropStmt } from "../parse.ts";
import { fromNameList } from "./table-name.ts";
import { unrecognized } from "./unrecognized.ts";

const STATEMENT = "DropStmt";

export function drop(stmt: DropStmt, at: (action: number) => StatementSource): Change[] {
  if (stmt.removeType !== "OBJECT_TABLE") {
    return [
      unrecognized(`${STATEMENT}/${stmt.removeType}`, "no normalizer for this DROP yet", at(0)),
    ];
  }
  return (stmt.objects ?? []).map((object, action) => {
    const ref = fromNameList(object);
    return ref.ok
      ? { kind: "DropTable", table: ref.table, source: at(action) }
      : unrecognized(STATEMENT, ref.reason, at(action));
  });
}
