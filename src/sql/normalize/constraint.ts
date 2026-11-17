// Reads an `ADD CONSTRAINT` (unique, primary key, check, foreign key) into an AddConstraint change.
import type { Change, StatementSource } from "../../types.ts";
import type { Constraint, Node } from "../parse.ts";
import { unrecognized } from "./unrecognized.ts";

const KINDS = {
  CONSTR_UNIQUE: "unique",
  CONSTR_PRIMARY: "primaryKey",
  CONSTR_CHECK: "check",
  CONSTR_FOREIGN: "foreignKey",
} as const;

export function addConstraint(
  table: string,
  constraint: Constraint,
  source: StatementSource,
): Change {
  const contype = constraint.contype;
  const kind =
    contype !== undefined && contype in KINDS ? KINDS[contype as keyof typeof KINDS] : undefined;
  if (kind === undefined) {
    return unrecognized(
      `AlterTableStmt/AT_AddConstraint/${contype}`,
      "no normalizer for this constraint",
      source,
    );
  }
  // A foreign key constrains its referencing columns; unique and primary key their keys.
  const columns = kind === "foreignKey" ? names(constraint.fk_attrs) : names(constraint.keys);
  return {
    kind: "AddConstraint",
    table,
    constraint: kind,
    name: constraint.conname ?? null,
    columns,
    source,
  };
}

function names(nodes: readonly Node[] | undefined): string[] {
  return (nodes ?? []).flatMap((n) =>
    "String" in n && n.String.sval !== undefined ? [n.String.sval] : [],
  );
}
