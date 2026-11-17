// Turns a ref (branch, tag or SHA) into the SHA of the commit it points at.
import { GitError } from "./errors.ts";
import { execGit } from "./git.ts";

export async function resolveCommit(repo: string, ref: string): Promise<string> {
  // --end-of-options: a ref like "--output=x" is read as a ref, never as an option.
  // ^{commit}: peels an annotated tag down to its commit.
  const result = await execGit(repo, [
    "rev-parse",
    "--verify",
    "--quiet",
    "--end-of-options",
    `${ref}^{commit}`,
  ]);
  // With --verify --quiet, exit 1 means exactly "no such commit"; other codes are real failures.
  if (result.exitCode === 1) {
    throw new GitError("REF_NOT_FOUND", `"${ref}" is not a branch, tag or commit in ${repo}`);
  }
  if (result.exitCode !== 0) {
    throw new GitError(
      "GIT_FAILED",
      `git rev-parse ${ref} exited ${result.exitCode}: ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}
