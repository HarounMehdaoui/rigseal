// Turns CREATE TABLE into CreateTable: a new table base can't be using yet.
import type { Change, StatementSource } from "../../types.ts";
import type { CreateStmt } from "../parse.ts";
import { fromRangeVar } from "./qualified-name.ts";
import { unrecognized } from "./unrecognized.ts";

export function createTable(stmt: CreateStmt, source: StatementSource): Change {
  const ref = fromRangeVar(stmt.relation);
  return ref.ok
    ? { kind: "CreateTable", table: ref.name, source }
    : unrecognized("CreateStmt", ref.reason, source);
}
