// One run of `rollback-gate verify`: arguments → read both files → cosign checks the signature → check the report → exit code.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { failureMessage } from "../cli/failure-message.ts";
import { cosignVerifyBlob } from "../sigstore/cosign.ts";
import { parseVerifyArgs } from "./args.ts";
import { checkReport } from "./check-report.ts";
import { Refusal } from "./refusal.ts";
import { VERIFY_USAGE } from "./usage.ts";

export interface VerifyIo {
  /** The cosign executable: "cosign" from PATH in the CLI, a fake in tests. */
  readonly cosign: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

/** 0 = deploy allowed, 1 = refused, 2 = the tool itself failed. */
export async function runVerify(argv: readonly string[], io: VerifyIo): Promise<0 | 1 | 2> {
  try {
    const parsed = parseVerifyArgs(argv);
    if (parsed.kind === "help") {
      io.stdout(VERIFY_USAGE);
      return 0;
    }
    const { report, bundle, signer, sha, failOn } = parsed.options;

    const reportBytes = await readOrRefuse(report, "report");
    await readOrRefuse(bundle, "bundle");

    // The bytes are read once: cosign verifies a private copy of them, and the same bytes are then
    // checked, so swapping the file between the two steps changes nothing.
    const dir = await mkdtemp(join(tmpdir(), "rg-verify-"));
    try {
      const blob = join(dir, "report.json");
      await writeFile(blob, reportBytes);
      const signature = await cosignVerifyBlob(io.cosign, { blob, bundle, signer, sha });
      if (!signature.ok) throw new Refusal(`the signature doesn't verify: ${signature.message}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }

    const verdict = checkReport(reportBytes.toString("utf8"), sha, failOn);
    io.stdout(
      `rollback-gate verify: OK: ${verdict} report for ${sha}, signed by ${signer.identity}\n`,
    );
    return 0;
  } catch (err) {
    if (err instanceof Refusal) {
      io.stderr(`rollback-gate verify: refused: ${err.message}\n`);
      return 1;
    }
    io.stderr(`${failureMessage(err)}\n`);
    return 2;
  }
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
