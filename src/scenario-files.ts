// Test support: reads scenario folders (`scenarios/<name>/{base,head,expected.json}`) from disk, with no git.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { MigrationSource, Severity, Snapshot, StatementSource } from "./types.ts";

/** What a scenario test compares for each entry (D41): no reason or fix prose. */
export interface ExpectedEntry {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly target: string;
  readonly source: StatementSource | MigrationSource;
}

export interface Scenario {
  readonly name: string;
  readonly base: Snapshot;
  readonly head: Snapshot;
  readonly expected: { readonly verdict: Severity; readonly entries: readonly ExpectedEntry[] };
}

const ROOT = new URL("../scenarios/", import.meta.url);

/** Every scenario folder, sorted by name. */
export function scenarioNames(): string[] {
  return readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function loadScenario(name: string): Scenario {
  const dir = new URL(`${name}/`, ROOT);
  const expected = JSON.parse(
    readFileSync(new URL("expected.json", dir), "utf8"),
  ) as Scenario["expected"];
  return {
    name,
    base: snapshot(new URL("base/", dir)),
    head: snapshot(new URL("head/", dir)),
    expected,
  };
}

/** `prisma/schema.prisma` plus every `prisma/migrations/<folder>/migration.sql` (Prisma's default paths, D6). */
function snapshot(dir: URL): Snapshot {
  const schema = readFileSync(new URL("prisma/schema.prisma", dir), "utf8");
  const migrationsDir = new URL("prisma/migrations/", dir);
  const folders = existsSync(migrationsDir)
    ? readdirSync(migrationsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
    : [];
  const migrations = folders.map((name) => ({
    name,
    sql: readFileSync(new URL(`${name}/migration.sql`, migrationsDir), "utf8"),
  }));
  return { schema, migrations };
}
