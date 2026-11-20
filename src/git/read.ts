// Reads files and folders as they are at a ref, never from the working tree.
import { normalizeRepoPath } from "../repo-path.ts";
import { GitError } from "./errors.ts";
import { runGit } from "./git.ts";
import { lookup, lsTree, SYMLINK_MODE } from "./ls-tree.ts";
import { resolveCommit } from "./resolve-commit.ts";

export interface DirEntry {
  readonly name: string;
  /** "other" = symlink or submodule: nothing the tool reads. */
  readonly kind: "file" | "dir" | "other";
}

export async function readFile(repo: string, ref: string, path: string): Promise<string> {
  const sha = await resolveCommit(repo, ref);
  const p = normalizeRepoPath(path);
  const entry = p === "" ? undefined : await lookup(repo, sha, p);
  if (p === "" || entry?.type === "tree") {
    throw new GitError("NOT_A_FILE", `"${path}" is a folder at ${ref}, not a file`);
  }
  if (entry === undefined) {
    throw new GitError("PATH_NOT_FOUND", `"${path}" does not exist at ${ref}`);
  }
  if (entry.type !== "blob" || entry.mode === SYMLINK_MODE) {
    throw new GitError("NOT_A_FILE", `"${path}" at ${ref} is a symlink or submodule, not a file`);
  }
  return runGit(repo, ["cat-file", "blob", entry.oid]);
}

/** Direct entries of a folder at a ref, in git's tree order (sorted by name). */
export async function listDir(
  repo: string,
  ref: string,
  path: string,
): Promise<readonly DirEntry[]> {
  const sha = await resolveCommit(repo, ref);
  const p = normalizeRepoPath(path);
  if (p !== "") {
    const entry = await lookup(repo, sha, p);
    if (entry === undefined) {
      throw new GitError("PATH_NOT_FOUND", `"${path}" does not exist at ${ref}`);
    }
    if (entry.type !== "tree") {
      throw new GitError("NOT_A_DIRECTORY", `"${path}" is not a folder at ${ref}`);
    }
  }
  const entries = await lsTree(repo, sha, p === "" ? undefined : `${p}/`);
  return entries.map((entry) => ({
    name: p === "" ? entry.path : entry.path.slice(p.length + 1),
    kind:
      entry.type === "tree"
        ? "dir"
        : entry.type === "blob" && entry.mode !== SYMLINK_MODE
          ? "file"
          : "other",
  }));
}
