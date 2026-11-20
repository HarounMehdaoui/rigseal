// The one place that runs git: execFile with an argument array, so no shell ever parses input.
import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitError } from "./errors.ts";

const execFileAsync = promisify(execFile);

export interface GitResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs git and reports its exit code instead of throwing on a non-zero one. */
export async function execGit(repo: string, args: readonly string[]): Promise<GitResult> {
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
