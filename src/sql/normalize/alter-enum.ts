// Turns ALTER TYPE … ADD VALUE into AddEnumValue; RENAME VALUE stays Unrecognized (base may write the old one).
import type { Change, StatementSource } from "../../types.ts";
import type { AlterEnumStmt } from "../parse.ts";
import { fromNameParts } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

const STATEMENT = "AlterEnumStmt";

export function alterEnum(stmt: AlterEnumStmt, source: StatementSource): Change {
  const ref = fromNameParts(stmt.typeName);
  if (!ref.ok) return unrecognized(STATEMENT, ref.reason, source);
  if (stmt.oldVal !== undefined)
    return unrecognized(STATEMENT, "RENAME VALUE has no rule yet", source);
  if (stmt.newVal === undefined)
    return unrecognized(STATEMENT, "the new value could not be read", source);
  return { kind: "AddEnumValue", enum: ref.name, value: stmt.newVal, source };
}
