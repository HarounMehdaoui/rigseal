// The only code that runs cosign: `verify-blob` with every identity claim pinned exactly, via execFile (no shell).
import { type ExecFileException, execFile } from "node:child_process";
import { promisify } from "node:util";
import { GITHUB_OIDC_ISSUER, type Signer } from "../verify/signer.ts";
import { CosignError } from "./cosign-error.ts";

const execFileAsync = promisify(execFile);

export interface VerifyBlobRequest {
  readonly blob: string;
  readonly bundle: string;
  readonly signer: Signer;
  /** The commit the signing workflow ran at. */
  readonly sha: string;
}

export type VerifyBlobResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/**
 * Exact values only: no `--certificate-identity-regexp`, no optional claim left out. The trigger is
 * pinned to `push` because the action signs on push events only.
 */
export async function cosignVerifyBlob(
  cosign: string,
  { blob, bundle, signer, sha }: VerifyBlobRequest,
): Promise<VerifyBlobResult> {
  const args = [
    "verify-blob",
    "--bundle",
    bundle,
    "--certificate-identity",
    signer.identity,
    "--certificate-oidc-issuer",
    GITHUB_OIDC_ISSUER,
    "--certificate-github-workflow-repository",
    signer.repository,
    "--certificate-github-workflow-ref",
    signer.ref,
    "--certificate-github-workflow-sha",
    sha,
    "--certificate-github-workflow-trigger",
    "push",
    "--",
    blob,
  ];
  try {
    await execFileAsync(cosign, args, { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } });
    return { ok: true };
  } catch (err) {
    const e = err as ExecFileException & { stderr?: string };
    // A numeric code is cosign's exit status: it ran and said no. Anything else: it never ran.
    if (typeof e.code !== "number") {
      throw new CosignError(`could not run cosign: ${e.message}`, { cause: err });
    }
    const first = String(e.stderr ?? "")
      .split("\n")
      .find((line) => line.trim() !== "");
    return { ok: false, message: first?.trim() ?? `cosign exited ${e.code}` };
  }
}
