// What a rule may look at besides the change itself: base's used set and every change in head's release.
import type { UsedSet } from "../schema/types.ts";
import type { Change } from "../types.ts";

export interface RuleContext {
  /** What base's client uses (RULES §2). */
  readonly used: UsedSet;
  /** Every change head's new migrations make, in order: RG-DB-005 judges a column's end state (D33). */
  readonly changes: readonly Change[];
}
