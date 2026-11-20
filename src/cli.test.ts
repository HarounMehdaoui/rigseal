import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo, type TestRepo } from "./git/test-repo.ts";
import { treeFiles } from "./tree-files.ts";

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

describe("cli determinism", () => {
  it("writes byte-identical JSON and Markdown when run twice on the same inputs", async () => {
    await repo.commit(
      "release",
      treeFiles(new URL("../scenarios/lab-backfill-hand-edit/base/", import.meta.url)),
    );
    await repo.git("tag", "v1");
    await repo.git("rm", "-r", "--quiet", "prisma");
    await repo.commit(
      "head",
      treeFiles(new URL("../scenarios/lab-backfill-hand-edit/head/", import.meta.url)),
    );

    // Two separate processes: no module state, cache or clock is shared between the runs.
    const first = await cli(["--json", "a.json", "--markdown", "a.md"]);
    const second = await cli(["--json", "b.json", "--markdown", "b.md"]);
    expect(first.code).toBe(1);
    expect(second.code).toBe(1);

    const read = (file: string) => readFile(join(repo.dir, file));
    expect((await read("a.json")).equals(await read("b.json"))).toBe(true);
    expect((await read("a.md")).equals(await read("b.md"))).toBe(true);
    expect(first.stdout).toBe(second.stdout);
    expect(JSON.parse(String(await read("a.json")))).toMatchObject({ verdict: "UNSAFE" });
  });
});
