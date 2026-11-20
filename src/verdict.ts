// The verdict over all entries: the worst one wins, and no entries at all is SAFE.
import type { Entry, Severity } from "./types.ts";

const RANK: Readonly<Record<Severity, number>> = { SAFE: 0, RISKY: 1, UNSAFE: 2 };

export function verdictOf(entries: readonly Entry[]): Severity {
  let worst: Severity = "SAFE";
  for (const { severity } of entries) {
    if (RANK[severity] > RANK[worst]) worst = severity;
  }
  return worst;
}
