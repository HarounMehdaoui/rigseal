// The only code that runs the gh CLI: finds the gate run for a commit and downloads its artifact, via execFile (no shell).
import { type ExecFileException, execFile } from "node:child_process";
import { basename } from "node:path";
import { promisify } from "node:util";
import { GhError } from "./gh-error.ts";

const execFileAsync = promisify(execFile);

export interface RunQuery {
  readonly repository: string;
  /** The signing workflow file, e.g. `.github/workflows/rigseal.yml`. */
  readonly workflow: string;
  /** `refs/heads/<branch>` or `refs/tags/<tag>`. */
  readonly ref: string;
  readonly sha: string;
}

export interface GateRun {
  readonly id: number;
  readonly conclusion: string;
}

/**
 * The newest completed `push` run of the workflow, on the ref's branch or tag, at the commit, whatever
 * its conclusion: a run that found UNSAFE fails its job but has already signed and uploaded its
 * report. What it holds is untrusted; the signature check decides.
 */
export async function findGateRun(gh: string, query: RunQuery): Promise<GateRun | null> {
  const stdout = await runGh(gh, "gh run list", [
    "run",
    "list",
    "--repo",
    query.repository,
    "--workflow",
    basename(query.workflow),
    "--commit",
    query.sha,
    "--event",
    "push",
    "--branch",
    query.ref.replace(/^refs\/(heads|tags)\//, ""),
    "--status",
    "completed",
    "--limit",
    "1",
    "--json",
    "databaseId,conclusion,headSha",
  ]);
  let runs: unknown;
  try {
    runs = JSON.parse(stdout);
  } catch {
    const detail = `gh run list returned something that isn't JSON: ${stdout.slice(0, 80)}`;
    throw new GhError(detail, true, detail);
  }
  const [run] = Array.isArray(runs) ? runs : [];
  // Belt and braces: only ever a run at exactly this commit.
  if (typeof run?.databaseId !== "number" || run.headSha !== query.sha) return null;
  return { id: run.databaseId, conclusion: String(run.conclusion) };
}

export interface ArtifactRequest {
  readonly repository: string;
  readonly runId: number;
  readonly name: string;
  readonly dir: string;
}

export type DownloadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** A missing or expired artifact is an answer (the deploy has no proof), not a tool failure. */
export async function downloadArtifact(
  gh: string,
  request: ArtifactRequest,
): Promise<DownloadResult> {
  const args = [
    "run",
    "download",
    String(request.runId),
    "--repo",
    request.repository,
    "--name",
    request.name,
    "--dir",
    request.dir,
  ];
  try {
    await runGh(gh, "gh run download", args);
    return { ok: true };
  } catch (err) {
    if (err instanceof GhError && err.ran) return { ok: false, message: err.detail };
    throw err;
  }
}

async function runGh(gh: string, what: string, args: readonly string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(gh, args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      // Never prompt; plain, untranslated output.
      env: { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1", LC_ALL: "C" },
    });
    return stdout;
  } catch (err) {
    const e = err as ExecFileException & { stderr?: string };
    if (typeof e.code !== "number") {
      throw new GhError(`could not run gh: ${e.message}`, false, e.message, { cause: err });
    }
    const first =
      String(e.stderr ?? "")
        .split("\n")
        .find((line) => line.trim() !== "")
        ?.trim() ?? `exited ${e.code}`;
    throw new GhError(`${what} failed: ${first}`, true, first, { cause: err });
  }
}
