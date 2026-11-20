// RG-DB-016 · Enum value removed: from an enum base uses → RISKY (base may still write it).
import type { Entry, RemoveEnumValue } from "../types.ts";
import type { RuleContext } from "./context.ts";

export const RULE_ID = "RG-DB-016";

export function enumValueRemoved(change: RemoveEnumValue, { used }: RuleContext): Entry {
  const target = `${change.enum}.${change.value}`;
  if (!used.enums.has(change.enum)) {
    return {
      ruleId: RULE_ID,
      severity: "SAFE",
      target,
      reason: `Base doesn't use enum "${change.enum}", so removing '${change.value}' can't break base.`,
      source: change.source,
    };
  }
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target,
    reason: `Base's client still knows '${change.value}' of enum "${change.enum}": base writes that use it fail with "invalid input value for enum".`,
    fix: "Stop writing the value in one release, and remove it one release later.",
    source: change.source,
  };
}
