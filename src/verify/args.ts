// Parses `rigseal verify` arguments: exactly one source, every check's input required, bad input a UsageError.
import { parseArgs } from "node:util";
import { UsageError } from "../cli/usage-error.ts";
import type { FailOn } from "../exit-code.ts";
import { type Signer, signerOf } from "./signer.ts";

/** Where the report and bundle come from: local files, or the gate run's artifact on GitHub. */
export type ReportSource =
  | { readonly kind: "files"; readonly report: string; readonly bundle: string }
  /** Artifact names to try, in order: the first one the run has is used. */
  | { readonly kind: "github"; readonly artifacts: readonly string[] };

export interface VerifyOptions {
  readonly source: ReportSource;
  /** The signing workflow file, as given (also used to find its runs). */
  readonly workflow: string;
  readonly signer: Signer;
  readonly sha: string;
  readonly failOn: FailOn;
}

export type ParsedVerifyArgs =
  | { readonly kind: "help" }
  | { readonly kind: "run"; readonly options: VerifyOptions };

/** The action's default artifact name, then its name before v0.4.0, for runs signed by older versions. */
const DEFAULT_ARTIFACTS = ["rigseal-report", "rollback-gate-report"];
const REQUIRED = ["repository", "workflow", "ref", "sha"] as const;
const FULL_SHA = /^[0-9a-f]{40}$/;
const ONE_SOURCE = "give either --report and --bundle, or --from-github";

export function parseVerifyArgs(argv: readonly string[]): ParsedVerifyArgs {
  const values = parse(argv);
  if (values.help === true) return { kind: "help" };

  for (const flag of ["report", "bundle", "artifact"] as const) {
    if (values[flag] === "") throw new UsageError(`--${flag} can't be empty`);
  }
  const source = sourceOf(
    values.report,
    values.bundle,
    values["from-github"] === true,
    values.artifact,
  );

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
    options: { source, workflow: given.workflow, signer: signerOf(given), sha: given.sha, failOn },
  };
}

/** Exactly one source: both files, or --from-github, never a mix or half of one. */
function sourceOf(
  report: string | undefined,
  bundle: string | undefined,
  fromGithub: boolean,
  artifact: string | undefined,
): ReportSource {
  if (fromGithub) {
    if (report !== undefined || bundle !== undefined) throw new UsageError(ONE_SOURCE);
    return { kind: "github", artifacts: artifact === undefined ? DEFAULT_ARTIFACTS : [artifact] };
  }
  if (artifact !== undefined) throw new UsageError("--artifact only goes with --from-github");
  if (report === undefined || bundle === undefined) throw new UsageError(ONE_SOURCE);
  return { kind: "files", report, bundle };
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
        "from-github": { type: "boolean" },
        artifact: { type: "string" },
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
