import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo, type TestRepo } from "./git/test-repo.ts";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("cli.ts", import.meta.url));

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
  await repo.commit("first");
});
afterEach(async () => {
  await repo.remove();
});

/** Runs the real entry point as a child process; Node strips the TypeScript types itself. */
async function cli(argv: string[], env: NodeJS.ProcessEnv = process.env) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...argv], {
      cwd: repo.dir,
      env,
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: number; stdout: string; stderr: string };
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

describe("cli entry point", () => {
  it("sets the process exit code to 2 on a bad ref, with one stderr line", async () => {
    const result = await cli(["--base", "nope"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/^rollback-gate: "nope" is not a branch, tag or commit[^\n]*\n$/);
  });

  it("exits 2 when git can't be found", async () => {
    const result = await cli([], { ...process.env, PATH: "" });
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/^rollback-gate: could not run git[^\n]*\n$/);
  });
});
