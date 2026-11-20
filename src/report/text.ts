// Renders the Report as terminal text: verdict, warnings, base → head, findings worst first, then SAFE notes one line each.
import { terminalText as t } from "./terminal-text.ts";
import type { Report, ReportEntry } from "./types.ts";
import { worstFirst } from "./worst-first.ts";

export function renderText(report: Report): string {
  const { findings, notes } = worstFirst(report.entries);
  const lines = [`Rollback Gate: ${report.verdict}`];
  for (const warning of report.warnings) lines.push(`warning: ${t(warning)}`);
  lines.push(
    `base: ${t(report.base.ref)} (${short(report.base.sha)}, ${report.base.method})`,
    `head: ${t(report.head.ref)} (${short(report.head.sha)})`,
    counts(report.entries),
  );

  for (const e of findings) {
    lines.push("", `${e.severity}  ${e.ruleId}  ${t(e.target)}`);
    lines.push(`  at ${t(where(e))}`, `  ${t(e.reason)}`);
    if (e.fix !== undefined) lines.push(`  fix: ${t(e.fix)}`);
  }

  if (notes.length > 0) {
    lines.push("", "SAFE notes:");
    for (const e of notes) {
      lines.push(`  ${e.ruleId}  ${t(e.target)}  ${t(where(e))}  ${t(e.reason)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function counts(entries: readonly ReportEntry[]): string {
  if (entries.length === 0) return "No changes to judge.";
  const n = (severity: string) => entries.filter((e) => e.severity === severity).length;
  const safe = n("SAFE");
  return `${n("UNSAFE")} UNSAFE, ${n("RISKY")} RISKY, ${safe} SAFE ${safe === 1 ? "note" : "notes"}`;
}

/** `file:line`; a whole-migration entry (line 0) is just the file. */
function where(e: ReportEntry): string {
  return e.line === 0 ? e.file : `${e.file}:${e.line}`;
}

function short(sha: string): string {
  return sha.slice(0, 7);
}
