// Checks a signed report's content for a deploy: it is a Rigseal report, about the deploy commit, with an allowed verdict.
import { exitCode, type FailOn } from "../exit-code.ts";
import type { Severity } from "../types.ts";
import { Refusal } from "./refusal.ts";

const VERDICTS: readonly string[] = ["SAFE", "RISKY", "UNSAFE"];
// The tool was called Rollback Gate before v0.4.0; reports it signed are still accepted.
const TOOL_NAMES: readonly unknown[] = ["rigseal", "rollback-gate"];

/**
 * Only call this on bytes whose signature has already been verified. Returns the verdict when the
 * deploy may go ahead; anything else is a Refusal. The verdict policy is the gate's own exit-code rule.
 */
export function checkReport(text: string, deploySha: string, failOn: FailOn): Severity {
  let report: unknown;
  try {
    report = JSON.parse(text);
  } catch {
    throw new Refusal("the report isn't valid JSON");
  }
  if (typeof report !== "object" || report === null || Array.isArray(report)) {
    throw new Refusal("the report isn't a JSON object");
  }
  const r = report as {
    schemaVersion?: unknown;
    tool?: { name?: unknown };
    head?: { sha?: unknown };
    verdict?: unknown;
  };
  if (r.schemaVersion !== 1 || !TOOL_NAMES.includes(r.tool?.name)) {
    throw new Refusal("the file isn't a Rigseal report with schemaVersion 1");
  }
  if (typeof r.head?.sha !== "string") throw new Refusal("the report names no head commit");
  if (typeof r.verdict !== "string" || !VERDICTS.includes(r.verdict)) {
    throw new Refusal("the report has no valid verdict");
  }

  // The signature proves who signed and at which commit; this proves what the report is about.
  if (r.head.sha !== deploySha) {
    throw new Refusal(
      `the report is about commit ${r.head.sha}, not the deploy commit ${deploySha}`,
    );
  }
  const verdict = r.verdict as Severity;
  if (exitCode(verdict, failOn) !== 0) {
    throw new Refusal(`the verdict is ${verdict}${failOn === "risky" ? " (fail-on risky)" : ""}`);
  }
  return verdict;
}
