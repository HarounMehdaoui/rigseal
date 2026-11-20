// Whether a column is added by this release itself: then RG-DB-005 judges its end state, not the later changes.
import type { RuleContext } from "./context.ts";

export function addedInRelease(table: string, column: string, { changes }: RuleContext): boolean {
  return changes.some((c) => c.kind === "AddColumn" && c.table === table && c.column === column);
}
