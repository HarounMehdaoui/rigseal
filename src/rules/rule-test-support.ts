// Test support: builds a rule context from base's schema text and the release's changes.
import { buildUsedSet } from "../schema/used-set.ts";
import type { Change, StatementSource } from "../types.ts";
import type { RuleContext } from "./context.ts";

/** Base's `schema.prisma`, with the datasource added. */
export function contextFor(models: string, changes: readonly Change[] = []): RuleContext {
  const used = buildUsedSet(`datasource db {\n  provider = "postgresql"\n}\n${models}`);
  return { used, changes };
}

/** Where a change comes from: migration `2_release`, the given line and action. */
export function at(line: number, action = 0): StatementSource {
  return { kind: "statement", migration: "2_release", line, action };
}
