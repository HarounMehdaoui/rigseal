// Lists the tree entries at a commit (`git ls-tree -z`), parsed into objects.
import { GitError } from "./errors.ts";
import { runGit } from "./git.ts";

export interface TreeEntry {
  readonly mode: string;
  readonly type: string;
  readonly oid: string;
  readonly path: string;
}

export const SYMLINK_MODE = "120000";

/** Parses `git ls-tree -z` output: "<mode> <type> <oid>\t<path>\0" per entry. */
function parseLsTree(output: string): TreeEntry[] {
  return output
    .split("\0")
    .filter((record) => record !== "")
    .map((record) => {
      const tab = record.indexOf("\t");
      const [mode, type, oid] = record.slice(0, tab).split(" ");
      if (tab < 0 || mode === undefined || type === undefined || oid === undefined) {
        throw new GitError(
          "GIT_FAILED",
          `unexpected git ls-tree output: ${JSON.stringify(record)}`,
        );
      }
      return { mode, type, oid, path: record.slice(tab + 1) };
    });
}

/** Runs ls-tree with a literal path (no glob matching), from the repo root. */
export async function lsTree(repo: string, sha: string, pathspec?: string): Promise<TreeEntry[]> {
  const args = ["--literal-pathspecs", "ls-tree", "-z", "--full-tree", sha];
  if (pathspec !== undefined) args.push("--", pathspec);
  return parseLsTree(await runGit(repo, args));
}

/** The tree entry for exactly this path, or undefined. Empty output is checked, never trusted. */
export async function lookup(
  repo: string,
  sha: string,
  path: string,
): Promise<TreeEntry | undefined> {
  return (await lsTree(repo, sha, path)).find((entry) => entry.path === path);
}
