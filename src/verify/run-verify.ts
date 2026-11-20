// One run of `rollback-gate verify`: arguments → get both files (local or the gate run's artifact) → cosign → check the report → exit code.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { failureMessage } from "../cli/failure-message.ts";
import { downloadArtifact, findGateRun } from "../github/gh.ts";
import { cosignVerifyBlob } from "../sigstore/cosign.ts";
import { parseVerifyArgs, type VerifyOptions } from "./args.ts";
import { checkReport } from "./check-report.ts";
import { Refusal } from "./refusal.ts";
import { VERIFY_USAGE } from "./usage.ts";

export interface VerifyIo {
  /** The cosign executable: "cosign" from PATH in the CLI, a fake in tests. */
  readonly cosign: string;
  /** The gh executable, used only with --from-github. */
  readonly gh: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

/** The two files as bytes, plus the run they came from when fetched. */
interface Evidence {
  readonly report: Buffer;
  readonly bundlePath: string;
  readonly runId: number | null;
}

/** 0 = deploy allowed, 1 = refused, 2 = the tool itself failed. */
export async function runVerify(argv: readonly string[], io: VerifyIo): Promise<0 | 1 | 2> {
  // One private folder per run: the fetched artifact and the copy cosign checks live here.
  let work: string | undefined;
  try {
    const parsed = parseVerifyArgs(argv);
    if (parsed.kind === "help") {
      io.stdout(VERIFY_USAGE);
      return 0;
    }
    const options = parsed.options;
    work = await mkdtemp(join(tmpdir(), "rg-verify-"));
    const evidence = await gather(options, io, work);

    // The bytes are read once: cosign verifies a private copy of them, and the same bytes are then
    // checked, so swapping a file between the two steps changes nothing.
    const blob = join(work, "verified-report.json");
    await writeFile(blob, evidence.report);
    const signature = await cosignVerifyBlob(io.cosign, {
      blob,
      bundle: evidence.bundlePath,
      signer: options.signer,
      sha: options.sha,
    });
    if (!signature.ok) throw new Refusal(`the signature doesn't verify: ${signature.message}`);

    const verdict = checkReport(evidence.report.toString("utf8"), options.sha, options.failOn);
    const run = evidence.runId === null ? "" : ` (run ${evidence.runId})`;
    io.stdout(
      `rollback-gate verify: OK: ${verdict} report for ${options.sha}${run}, signed by ${options.signer.identity}\n`,
    );
    return 0;
  } catch (err) {
    if (err instanceof Refusal) {
      io.stderr(`rollback-gate verify: refused: ${err.message}\n`);
      return 1;
    }
    io.stderr(`${failureMessage(err)}\n`);
    return 2;
  } finally {
    if (work !== undefined) await rm(work, { recursive: true, force: true });
  }
}

/** Local files as given, or the newest completed gate run's artifact for the deploy commit. */
async function gather(options: VerifyOptions, io: VerifyIo, work: string): Promise<Evidence> {
  if (options.source.kind === "files") {
    const report = await readOrRefuse(options.source.report, "report");
    await readOrRefuse(options.source.bundle, "bundle");
    return { report, bundlePath: options.source.bundle, runId: null };
  }

  const { repository, ref } = options.signer;
  const run = await findGateRun(io.gh, {
    repository,
    workflow: options.workflow,
    ref,
    sha: options.sha,
  });
  if (run === null) {
    throw new Refusal(
      `no completed push run of ${options.workflow} on ${ref} at ${options.sha} in ${repository}`,
    );
  }
  const dir = join(work, "artifact");
  // Created here rather than relying on gh to create it.
  await mkdir(dir);
  const name = options.source.artifact;
  const download = await downloadArtifact(io.gh, { repository, runId: run.id, name, dir });
  if (!download.ok) {
    throw new Refusal(`can't download artifact "${name}" of run ${run.id}: ${download.message}`);
  }
  // Whatever was downloaded is untrusted: it only counts if the signature verifies below.
  const bundlePath = join(dir, "report.sigstore.json");
  const report = await readOrRefuse(join(dir, "report.json"), "report");
  await readOrRefuse(bundlePath, "bundle");
  return { report, bundlePath, runId: run.id };
}

/** A missing or unreadable file means there's no proof: the deploy is refused, not the tool broken. */
async function readOrRefuse(path: string, what: "report" | "bundle"): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new Refusal(`can't read the ${what} file: ${why}`);
  }
}
