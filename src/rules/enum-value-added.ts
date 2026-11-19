// RG-DB-015 · Enum value added (RULES §4): to an enum base uses → RISKY (base can't read the new value).
import type { AddEnumValue, Entry } from "../types.ts";
import type { RuleContext } from "./context.ts";
import { objectTarget } from "./target.ts";

export const RULE_ID = "RG-DB-015";

export function enumValueAdded(change: AddEnumValue, { used }: RuleContext): Entry {
  const target = objectTarget(change.enum);
  if (!used.enums.has(change.enum)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `No column base uses has enum "${change.enum}", so a new value in it can't reach base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `Base reads enum "${change.enum}": base reads of rows that hold '${change.value}' fail, because Prisma raises P2023 for a value its client doesn't know (RULES §6 row 7).`,
    fix: "Add the value in one release without writing it, and start writing it one release later.",
    source: change.source,
  };
}
