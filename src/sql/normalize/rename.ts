// Turns a RENAME of a table, column, index, constraint or enum into its Rename… change.
import type { Change, StatementSource } from "../../types.ts";
import type { RenameStmt } from "../parse.ts";
import { fromNameParts, fromRangeVar, type NameRef } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

const STATEMENT = "RenameStmt";

export function rename(stmt: RenameStmt, source: StatementSource): Change {
  const what = `${STATEMENT}/${stmt.renameType}`;
  const newName = stmt.newname;
  if (newName === undefined) return unrecognized(what, "the new name could not be read", source);

  const named = (ref: NameRef, make: (name: string) => Change): Change =>
    ref.ok ? make(ref.name) : unrecognized(what, ref.reason, source);

  switch (stmt.renameType) {
    case "OBJECT_TABLE":
      return named(fromRangeVar(stmt.relation), (table) => ({
        kind: "RenameTable",
        table,
        newName,
        source,
      }));
    case "OBJECT_COLUMN": {
      const column = stmt.subname;
      if (stmt.relationType !== "OBJECT_TABLE" || column === undefined) {
        return unrecognized(what, "not a table column", source);
      }
      return named(fromRangeVar(stmt.relation), (table) => ({
        kind: "RenameColumn",
        table,
        column,
        newName,
        source,
      }));
    }
    case "OBJECT_INDEX":
      return named(fromRangeVar(stmt.relation), (name) => ({
        kind: "RenameIndex",
        name,
        newName,
        source,
      }));
    case "OBJECT_TABCONSTRAINT": {
      // Prisma renames a primary or foreign key this way; base never names them.
      const name = stmt.subname;
      if (name === undefined) return unrecognized(what, "the constraint could not be read", source);
      return named(fromRangeVar(stmt.relation), () => ({
        kind: "RenameIndex",
        name,
        newName,
        source,
      }));
    }
    case "OBJECT_TYPE":
      return named(fromNameParts(stmt.object), (name) => ({
        kind: "RenameEnum",
        enum: name,
        newName,
        source,
      }));
    default:
      return unrecognized(what, "no normalizer for this RENAME yet", source);
  }
}
