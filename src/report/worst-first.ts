// Splits entries for people: findings UNSAFE first then RISKY, and the SAFE notes apart, each in JSON order.
import type { ReportEntry } from "./types.ts";

export interface ForPeople {
  readonly findings: readonly ReportEntry[];
  readonly notes: readonly ReportEntry[];
}

export function worstFirst(entries: readonly ReportEntry[]): ForPeople {
  const of = (severity: ReportEntry["severity"]) => entries.filter((e) => e.severity === severity);
  return { findings: [...of("UNSAFE"), ...of("RISKY")], notes: of("SAFE") };
}
