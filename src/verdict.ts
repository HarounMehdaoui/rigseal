// The verdict over all entries: the worst one wins (D2). Built in T5.3 with the entry order (D29).
import type { Entry, Severity } from "./types.ts";

export function verdictOf(_entries: readonly Entry[]): Severity {
  throw new Error("not implemented: the verdict is T5.3");
}
