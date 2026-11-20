// Reads one side (base or head) at a commit into a Snapshot: the schema text and every migration's SQL (D6, D48).
import type { Snapshot } from "../types.ts";
import { GitError } from "./errors.ts";
import { listDir, readFile } from "./read.ts";

/** Repo-relative paths (D6): Prisma's defaults unless the user passed `--schema` / `--migrations`. */
export interface SnapshotPaths {
  readonly schema: string;
  readonly migrations: string;
}

/** Pass a commit SHA, not a branch, so both reads see the same commit the report names. */
export async function readSnapshot(
  repo: string,
  sha: string,
  paths: SnapshotPaths,
): Promise<Snapshot> {
  const schema = await readFile(repo, sha, paths.schema);
  return { schema, migrations: await readMigrations(repo, sha, paths.migrations) };
}

async function readMigrations(
  repo: string,
  sha: string,
  dir: string,
): Promise<Snapshot["migrations"]> {
  let entries: Awaited<ReturnType<typeof listDir>>;
  try {
    entries = await listDir(repo, sha, dir);
  } catch (err) {
    // No folder yet: a project before its first migration (D48).
    if (err instanceof GitError && err.code === "PATH_NOT_FOUND") return [];
    throw err;
  }

  const migrations: { name: string; sql: string }[] = [];
  // Sequential, in git's tree order (sorted by name): a few git calls per migration, no fan-out.
  for (const entry of entries) {
    if (entry.kind === "file") continue; // migration_lock.toml and other plain files
    if (entry.kind === "other") {
      // A symlink or submodule could hide a migration; fail closed rather than skip it.
      throw new GitError(
        "NOT_A_DIRECTORY",
        `"${dir}/${entry.name}" at ${sha} is a symlink or submodule, not a migration folder`,
      );
    }
    // A folder without migration.sql surfaces as readFile's PATH_NOT_FOUND, naming the path (D48).
    const sql = await readFile(repo, sha, `${dir}/${entry.name}/migration.sql`);
    migrations.push({ name: entry.name, sql });
  }
  return migrations;
}
