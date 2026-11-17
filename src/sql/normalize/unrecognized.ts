// Builds the Unrecognized change: the fail-closed answer for anything the normalizer doesn't model (D13).
import type { StatementSource, Unrecognized } from "../../types.ts";

export function unrecognized(
  statement: string,
  reason: string,
  source: StatementSource,
): Unrecognized {
  return { kind: "Unrecognized", statement, reason, source };
}
