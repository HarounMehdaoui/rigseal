// The exit code for a verdict: 0 SAFE or RISKY, 1 UNSAFE; `--fail-on risky` makes RISKY 1 too.
import type { Severity } from "./types.ts";

/** Exit 2 isn't here: it means the tool itself failed, which the CLI decides. */
export type FailOn = "unsafe" | "risky";

export function exitCode(verdict: Severity, failOn: FailOn): 0 | 1 {
  if (verdict === "UNSAFE") return 1;
  if (verdict === "RISKY" && failOn === "risky") return 1;
  return 0;
}
