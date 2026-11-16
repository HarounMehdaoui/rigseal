// Reads files and folders as they are at a ref, never from the working tree.
import { GitError, resolveCommit, runGit } from "./git.ts";

export interface DirEntry {
  readonly name: string;
  /** "other" = symlink or submodule: nothing the tool reads. */
  readonly kind: "file" | "dir" | "other";
}

interface TreeEntry {
  readonly mode: string;
  readonly type: string;
  readonly oid: string;
  readonly path: string;
}

const SYMLINK_MODE = "120000";

/** Repo-relative POSIX path without "./" in front or "/" at the end; "" is the repo root. */
function normalize(path: string): string {
  return path.replace(/^(\.\/)+/, "").replace(/\/+$/, "");
}

/** Parses `git ls-tree -z` output: "<mode> <type> <oid>\t<path>\0" per entry. */
function parseLsTree(output: string): TreeEntry[] {
  return output
    .split("\0")
    .filter((record) => record !== "")
    .map((record) => {
      const tab = record.indexOf("\t");
      const [mode, type, oid] = record.slice(0, tab).split(" ");
      if (tab < 0 || mode === undefined || type === undefined || oid === undefined) {
        throw new GitError("GIT_FAILED", `unexpected git ls-tree output: ${JSON.stringify(record)}`);
      }
      return { mode, type, oid, path: record.slice(tab + 1) };
    });
}

/** Runs ls-tree with a literal path (no glob matching), from the repo root. */
async function lsTree(repo: string, sha: string, pathspec?: string): Promise<TreeEntry[]> {
  const args = ["--literal-pathspecs", "ls-tree", "-z", "--full-tree", sha];
  if (pathspec !== undefined) args.push("--", pathspec);
  return parseLsTree(await runGit(repo, args));
}

/** The tree entry for exactly this path, or undefined. Empty output is checked, never trusted. */
async function lookup(repo: string, sha: string, path: string): Promise<TreeEntry | undefined> {
  return (await lsTree(repo, sha, path)).find((entry) => entry.path === path);
}

export async function readFile(repo: string, ref: string, path: string): Promise<string> {
  const sha = await resolveCommit(repo, ref);
  const p = normalize(path);
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
  const p = normalize(path);
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
