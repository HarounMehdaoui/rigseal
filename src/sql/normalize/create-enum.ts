// Turns CREATE TYPE … AS ENUM into CreateEnum with its values.
import type { Change, StatementSource } from "../../types.ts";
import type { CreateEnumStmt } from "../parse.ts";
import { fromNameParts } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

export function createEnum(stmt: CreateEnumStmt, source: StatementSource): Change {
  const ref = fromNameParts(stmt.typeName);
  if (!ref.ok) return unrecognized("CreateEnumStmt", ref.reason, source);
  const values = (stmt.vals ?? []).flatMap((v) =>
    "String" in v && v.String.sval !== undefined ? [v.String.sval] : [],
  );
  return { kind: "CreateEnum", enum: ref.name, values, source };
}
