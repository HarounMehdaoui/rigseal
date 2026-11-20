// e2e support: runs the built CLI (`node dist/cli.js`, what ships) in a repo and returns its exit code, output and JSON report.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isolatedEnv } from "../src/git/test-repo.ts";
import type { Report } from "../src/report/types.ts";

const execFileAsync = promisify(execFile);
const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

export interface CliRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly report: Report;
}

/** Always asks for a JSON report, written outside the repo so no later `git add` picks it up. */
export async function runCli(repo: string, argv: readonly string[]): Promise<CliRun> {
  const out = await mkdtemp(join(tmpdir(), "rg-e2e-"));
  try {
    return await run(repo, argv, join(out, "report.json"));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}

async function run(repo: string, argv: readonly string[], json: string): Promise<CliRun> {
  const args = [CLI, ...argv, "--json", json];
  let result: { code: number; stdout: string; stderr: string };
  try {
    // The user's git config could change tag sorting; the CLI's git sees none of it.
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: repo,
      env: isolatedEnv,
    });
    result = { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code: unknown; stdout: string; stderr: string };
    if (typeof e.code !== "number") throw err;
    result = { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
  if (result.code === 2) throw new Error(`the CLI failed (exit 2): ${result.stderr}`);
  const report = JSON.parse(await readFile(json, "utf8")) as Report;
  return { ...result, report };
}
