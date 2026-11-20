// Reads a column definition: its type, whether it ends NOT NULL, and whether the database fills it.
import type { PgType } from "../../types.ts";
import type { ColumnDef } from "../parse.ts";
import { pgType } from "./type-name.ts";

export interface ColumnShape {
  readonly column: string;
  readonly type: PgType;
  readonly notNull: boolean;
  readonly hasDefault: boolean;
}

/** `SERIAL` isn't a type: it's an integer type + NOT NULL + a sequence default. */
const SERIAL_TYPES: Readonly<Record<string, string>> = {
  smallserial: "int2",
  serial2: "int2",
  serial: "int4",
  serial4: "int4",
  bigserial: "int8",
  serial8: "int8",
};

/** `undefined` when the definition lacks a name or a type (never from Postgres's grammar). */
export function readColumnDef(def: ColumnDef): ColumnShape | undefined {
  if (def.colname === undefined || def.typeName === undefined) return undefined;
  const type = pgType(def.typeName);
  const serial = type.array ? undefined : SERIAL_TYPES[type.name];

  let notNull = def.is_not_null === true || serial !== undefined;
  let hasDefault = serial !== undefined;
  for (const node of def.constraints ?? []) {
    if (!("Constraint" in node)) continue;
    switch (node.Constraint.contype) {
      case "CONSTR_NOTNULL":
      case "CONSTR_PRIMARY":
        notNull = true;
        break;
      case "CONSTR_NULL":
        notNull = false;
        break;
      case "CONSTR_DEFAULT":
      case "CONSTR_GENERATED":
        hasDefault = true;
        break;
      case "CONSTR_IDENTITY":
        // An identity column is NOT NULL even when the SQL doesn't say so.
        notNull = true;
        hasDefault = true;
        break;
      default:
        // UNIQUE, CHECK, REFERENCES: constraints, not nullability or defaults.
        break;
    }
  }
  return {
    column: def.colname,
    type: serial === undefined ? type : { name: serial, args: [], array: false },
    notNull,
    hasDefault,
  };
}
