// Parses `rollback-gate verify` arguments: every check's input is required, and bad input is a UsageError.
import { parseArgs } from "node:util";
import { UsageError } from "../cli/usage-error.ts";
import type { FailOn } from "../exit-code.ts";
import { type Signer, signerOf } from "./signer.ts";

export interface VerifyOptions {
  readonly report: string;
  readonly bundle: string;
  readonly signer: Signer;
  readonly sha: string;
  readonly failOn: FailOn;
}

export type ParsedVerifyArgs =
  | { readonly kind: "help" }
  | { readonly kind: "run"; readonly options: VerifyOptions };

const REQUIRED = ["report", "bundle", "repository", "workflow", "ref", "sha"] as const;
const FULL_SHA = /^[0-9a-f]{40}$/;

export function parseVerifyArgs(argv: readonly string[]): ParsedVerifyArgs {
  const values = parse(argv);
  if (values.help === true) return { kind: "help" };

  // No defaults for the checks themselves: a check that silently defaults is one users forget.
  const given = {} as Record<(typeof REQUIRED)[number], string>;
  for (const flag of REQUIRED) {
    const value = values[flag];
    if (value === undefined || value === "") throw new UsageError(`--${flag} is required`);
    given[flag] = value;
  }
  if (!FULL_SHA.test(given.sha)) {
    throw new UsageError(
      `--sha must be a full 40-character commit SHA in lowercase, not "${given.sha}"`,
    );
  }
  const failOn = values["fail-on"] ?? "unsafe";
  if (failOn !== "unsafe" && failOn !== "risky") {
    throw new UsageError(`--fail-on must be "risky" or "unsafe", not "${failOn}"`);
  }

  return {
    kind: "run",
    options: {
      report: given.report,
      bundle: given.bundle,
      signer: signerOf(given),
      sha: given.sha,
      failOn,
    },
  };
}

/** Strict: an unknown flag (say, a regexp option copied from cosign) is an error, not ignored. */
function parse(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        report: { type: "string" },
        bundle: { type: "string" },
        repository: { type: "string" },
        workflow: { type: "string" },
        ref: { type: "string" },
        sha: { type: "string" },
        "fail-on": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    }).values;
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err), { cause: err });
  }
}
