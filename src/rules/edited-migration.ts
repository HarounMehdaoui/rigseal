// RG-DB-020 · Edited or removed migration.
// RISKY, not UNSAFE: Prisma never re-runs an applied migration, so production and base's rollback
// are unaffected; only environments built fresh from head's history now differ from production.
import type { EditedMigration, Entry } from "../types.ts";

export const RULE_ID = "RG-DB-020";

export function editedMigration(change: EditedMigration): Entry {
  const name = change.source.migration;
  const what =
    change.edit === "modified"
      ? `Migration ${name} was released in base and edited in head.`
      : `Migration ${name} was released in base and removed in head.`;
  return {
    ruleId: RULE_ID,
    severity: "RISKY",
    target: name,
    reason: `${what} Environments built from head's history now differ from production, which applied the old version.`,
    fix: "Never edit or delete an applied migration: restore the released version and put the change in a new migration.",
    source: change.source,
  };
}
