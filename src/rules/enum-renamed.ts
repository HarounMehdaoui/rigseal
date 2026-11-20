// RG-DB-017 · Enum type renamed: an enum base uses → UNSAFE (base casts to the old name).
import type { Entry, RenameEnum } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { objectTarget } from "./target.ts";

export const RULE_ID = "RG-DB-017";

export function enumRenamed(change: RenameEnum, { used }: RuleContext): Entry {
  const target = objectTarget(change.enum);
  if (!used.enums.has(change.enum)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use enum "${change.enum}", so renaming it can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "UNSAFE",
    target,
    reason: `Base's queries cast to enum "${change.enum}" by name (Prisma sends CAST($1::text AS "public"."${change.enum}")), and after the rename to "${change.newName}" that type no longer exists: every base write to its columns fails.`,
    fix: `Keep the database name and rename in Prisma only (@@map("${change.enum}") on the enum).`,
    source: change.source,
  };
}
