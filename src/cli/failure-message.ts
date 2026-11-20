// Turns any error that stops a run into the one stderr line printed with exit 2.
import { GitError } from "../git/errors.ts";
import { SchemaError } from "../schema/schema-error.ts";
import { CosignError } from "../sigstore/cosign-error.ts";
import { OutputError } from "./output-error.ts";
import { UsageError } from "./usage-error.ts";

/**
 * Known failures (bad arguments, git, base's schema, a report file, cosign not running) keep their
 * own words; anything else is a bug in the tool and says so. Only the first line is kept: Prisma's
 * messages carry code frames.
 */
export function failureMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err);
  const line = text.split("\n", 1)[0]?.trim() ?? "";
  if (err instanceof UsageError) return `rollback-gate: ${line} (see --help)`;
  const known =
    err instanceof GitError ||
    err instanceof SchemaError ||
    err instanceof OutputError ||
    err instanceof CosignError;
  if (known) return `rollback-gate: ${line}`;
  return `rollback-gate: internal error: ${line}`;
}
