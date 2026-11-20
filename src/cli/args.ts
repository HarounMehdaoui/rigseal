// Parses the command line into options, filling defaults (D6, D46) and rejecting bad input with a UsageError.
import { parseArgs } from "node:util";
import type { FailOn } from "../exit-code.ts";
import { UsageError } from "./usage-error.ts";

/** How base is chosen: a ref given outright, or the latest release tag on a branch (D5, D47). */
export type BaseOption =
  | { readonly kind: "explicit"; readonly ref: string }
  | { readonly kind: "tag"; readonly target: string; readonly pattern: string };

export interface CliOptions {
  readonly head: string;
  readonly base: BaseOption;
  readonly schema: string;
  readonly migrations: string;
  readonly failOn: FailOn;
}

export type ParsedArgs = { readonly kind: "help" } | { readonly kind: "run"; options: CliOptions };

const VALUE_FLAGS = [
  "base",
  "head",
  "target",
  "tag-pattern",
  "schema",
  "migrations",
  "fail-on",
] as const;

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
  const values = parse(argv);
  if (values.help === true) return { kind: "help" };

  for (const flag of VALUE_FLAGS) {
    if (values[flag] === "") throw new UsageError(`--${flag} can't be empty`);
  }

  const failOn = values["fail-on"] ?? "unsafe";
  if (failOn !== "unsafe" && failOn !== "risky") {
    throw new UsageError(`--fail-on must be "risky" or "unsafe", not "${failOn}"`);
  }

  return {
    kind: "run",
    options: {
      head: values.head ?? "HEAD",
      base: baseOption(values.base, values.target, values["tag-pattern"]),
      schema: values.schema ?? "prisma/schema.prisma",
      migrations: values.migrations ?? "prisma/migrations",
      failOn,
    },
  };
}

function baseOption(
  base: string | undefined,
  target: string | undefined,
  pattern: string | undefined,
): BaseOption {
  if (base === undefined) {
    return { kind: "tag", target: target ?? "main", pattern: pattern ?? "v*" };
  }
  // Two ways of choosing base at once conflict; refuse instead of silently picking one (D47).
  if (target !== undefined) throw new UsageError("--base can't be combined with --target");
  if (pattern !== undefined) throw new UsageError("--base can't be combined with --tag-pattern");
  return { kind: "explicit", ref: base };
}

/** Node's own parser in strict mode: unknown flags, missing values and positionals all throw. */
function parse(argv: readonly string[]) {
  try {
    return parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        base: { type: "string" },
        head: { type: "string" },
        target: { type: "string" },
        "tag-pattern": { type: "string" },
        schema: { type: "string" },
        migrations: { type: "string" },
        "fail-on": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
    }).values;
  } catch (err) {
    // parseArgs throws a TypeError with a readable message (ERR_PARSE_ARGS_*): keep its words.
    throw new UsageError(err instanceof Error ? err.message : String(err), { cause: err });
  }
}
