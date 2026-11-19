// RG-DB-000 (D40): the SAFE note for a recognized change no rule judges (RULES §4's no-rule table).
import type {
  CreateEnum,
  CreateIndex,
  CreateTable,
  DropConstraint,
  DropEnum,
  DropIndex,
  Entry,
  RenameIndex,
  SetDefault,
} from "../types.ts";
import { columnTarget, objectTarget, tableTarget } from "./target.ts";

export const RULE_ID = "RG-DB-000";

export type HarmlessChange =
  | CreateTable
  | CreateIndex
  | DropIndex
  | DropConstraint
  | RenameIndex
  | SetDefault
  | CreateEnum
  | DropEnum;

export function harmlessChange(change: HarmlessChange): Entry {
  const [target, reason] = describe(change);
  return { ruleId: RULE_ID, severity: "SAFE", target, reason, source: change.source };
}

function describe(change: HarmlessChange): [target: string, reason: string] {
  switch (change.kind) {
    case "CreateTable":
      return [
        tableTarget(change.table),
        `Base doesn't know the new table "${change.table}", so it can't break base.`,
      ];
    case "CreateIndex":
      return [
        objectTarget(change.name, change.table),
        "A non-unique index doesn't change what base can read or write.",
      ];
    case "DropIndex":
      return [
        objectTarget(change.name),
        "Dropping an index relaxes the database's rules. (Whether base's upsert relies on it as a unique index is RG-DB-023, not checked in v0.1.)",
      ];
    case "DropConstraint":
      return [
        objectTarget(change.name, change.table),
        "Dropping a constraint relaxes the database's rules, so base's writes still succeed.",
      ];
    case "RenameIndex":
      return [
        objectTarget(change.name),
        "Base never names indexes or constraints, so renaming one can't break base.",
      ];
    case "SetDefault":
      return [
        columnTarget(change.table, change.column),
        `Setting a default on "${change.table}"."${change.column}" can't break base: base's inserts still succeed.`,
      ];
    case "CreateEnum":
      return [
        objectTarget(change.enum),
        `Base can't use the new type "${change.enum}", so it can't break base.`,
      ];
    case "DropEnum":
      return [
        objectTarget(change.enum),
        "Postgres refuses to drop an enum a column still has, so a used enum's column change is already judged by the column rules.",
      ];
  }
}
