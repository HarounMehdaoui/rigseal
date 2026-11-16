// The one place that runs git (D34): execFile with an argument array, so no shell ever parses input.
import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitErrorCode =
  | "REF_NOT_FOUND"
  | "PATH_NOT_FOUND"
  | "NOT_A_FILE"
  | "NOT_A_DIRECTORY"
  | "GIT_FAILED";

/** Every git problem surfaces as this one error type; the CLI maps it to exit 2. */
export class GitError extends Error {
  readonly code: GitErrorCode;

  constructor(code: GitErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GitError";
    this.code = code;
  }
}

interface GitResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs git and reports its exit code instead of throwing on a non-zero one. */
async function execGit(repo: string, args: readonly string[]): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
      // Never wait for a password prompt; keep git's messages in English for error reports.
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    const e = err as ExecFileException;
    // A numeric code is git's exit status. Anything else (ENOENT: git isn't installed, a signal,
    // output over maxBuffer) means git didn't run to completion.
    if (typeof e.code !== "number") {
      throw new GitError("GIT_FAILED", `could not run git: ${e.message}`, { cause: err });
    }
    return { exitCode: e.code, stdout: String(e.stdout ?? ""), stderr: String(e.stderr ?? "") };
  }
}

/** Runs `git -C <repo> <args>` and returns stdout; any non-zero exit is a GIT_FAILED error. */
export async function runGit(repo: string, args: readonly string[]): Promise<string> {
  const result = await execGit(repo, args);
  if (result.exitCode !== 0) {
    throw new GitError(
      "GIT_FAILED",
      `git ${args.join(" ")} exited ${result.exitCode}: ${result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

/** Resolves a ref (branch, tag, SHA) to the SHA of the commit it points at. */
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
