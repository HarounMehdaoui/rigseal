// Turns DROP TABLE / INDEX / TYPE into one change per object named (`DROP TABLE a, b` → actions 0 and 1).
import type { Change, StatementSource } from "../../types.ts";
import type { DropStmt } from "../parse.ts";
import { fromNameParts } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

const STATEMENT = "DropStmt";

const KINDS = {
  OBJECT_TABLE: "DropTable",
  OBJECT_INDEX: "DropIndex",
  // Prisma only ever creates enum types, so a dropped type is a dropped enum.
  OBJECT_TYPE: "DropEnum",
} as const;

export function drop(stmt: DropStmt, at: (action: number) => StatementSource): Change[] {
  const removeType = stmt.removeType;
  const kind =
    removeType !== undefined && removeType in KINDS
      ? KINDS[removeType as keyof typeof KINDS]
      : undefined;
  if (kind === undefined) {
    return [unrecognized(`${STATEMENT}/${removeType}`, "no normalizer for this DROP yet", at(0))];
  }
  return (stmt.objects ?? []).map((object, action): Change => {
    const ref = fromNameParts(object);
    if (!ref.ok) return unrecognized(STATEMENT, ref.reason, at(action));
    const source = at(action);
    if (kind === "DropTable") return { kind, table: ref.name, source };
    if (kind === "DropIndex") return { kind, name: ref.name, source };
    return { kind, enum: ref.name, source };
  });
}
