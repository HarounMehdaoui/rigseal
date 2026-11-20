// Test support: builds throwaway git repos in the OS temp folder.
// It runs git itself (not the module under test), with the user's global and system config switched
// off and a fixed author, so tests behave the same on every machine and in CI.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** git's environment with global and system config off and a fixed author; also for spawned CLIs. */
export const isolatedEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

export interface TestRepo {
  readonly dir: string;
  /** Runs git in the repo and returns trimmed stdout. */
  git(...args: string[]): Promise<string>;
  /** Writes a file (creating folders), stages everything, commits, and returns the commit SHA. */
  commit(message: string, files?: Record<string, string>): Promise<string>;
  remove(): Promise<void>;
}

export async function makeRepo(): Promise<TestRepo> {
  const dir = await mkdtemp(join(tmpdir(), "rg-git-"));

  const git = async (...args: string[]): Promise<string> => {
    const { stdout } = await execFileAsync("git", ["-C", dir, ...args], { env: isolatedEnv });
    return stdout.trim();
  };

  await git("init", "--quiet", "--initial-branch=main");

  return {
    dir,
    git,
    async commit(message, files = {}) {
      for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await writeFile(join(dir, path), content);
      }
      await git("add", "--all");
      await git("commit", "--quiet", "--allow-empty", "--message", message);
      return git("rev-parse", "HEAD");
    },
    remove: () => rm(dir, { recursive: true, force: true }),
  };
}
