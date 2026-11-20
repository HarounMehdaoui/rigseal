// Renders the Report as Markdown for the PR comment and job summary (D50): findings worst first, SAFE notes folded.
import { codeSpan, escapeMarkdown } from "./markdown-text.ts";
import type { Report, ReportEntry } from "./types.ts";
import { worstFirst } from "./worst-first.ts";

/** Day 7's action finds its own sticky comment by this marker (D17). */
const MARKER = "<!-- rollback-gate -->";

const BADGE = { SAFE: "🟢", RISKY: "🟡", UNSAFE: "🔴" } as const;

/**
 * Everything taken from the PR (names, refs, parser messages inside reasons) is either a code span
 * or escaped prose, so it can't add HTML, links or headings to the comment. Not handled: an `@name`
 * inside prose still renders as a GitHub mention (backslashes don't stop it).
 */
export function renderMarkdown(report: Report): string {
  const { findings, notes } = worstFirst(report.entries);
  const blocks = [`${MARKER}\n## Rollback Gate: ${BADGE[report.verdict]} ${report.verdict}`];

  if (report.warnings.length > 0) {
    // A GitHub alert; each warning is its own paragraph inside it.
    const body = report.warnings.map((w) => `> ${escapeMarkdown(w)}`).join("\n>\n");
    blocks.push(`> [!WARNING]\n${body}`);
  }

  const { base, head } = report;
  blocks.push(
    `Base ${codeSpan(base.ref)} (${codeSpan(short(base.sha))}, ${base.method}) → ` +
      `head ${codeSpan(head.ref)} (${codeSpan(short(head.sha))})`,
    counts(report.entries),
  );

  for (const e of findings) {
    const finding = [
      `### ${BADGE[e.severity]} ${e.severity} · ${e.ruleId} · ${codeSpan(e.target)}`,
      codeSpan(where(e)),
      "",
      escapeMarkdown(e.reason),
    ];
    if (e.fix !== undefined) finding.push("", `**Fix:** ${escapeMarkdown(e.fix)}`);
    blocks.push(finding.join("\n"));
  }

  if (notes.length > 0) {
    // Blank lines around the list: GitHub only renders Markdown inside <details> when separated.
    const items = notes.map(
      (e) =>
        `- ${e.ruleId} · ${codeSpan(e.target)} · ${codeSpan(where(e))} — ${escapeMarkdown(e.reason)}`,
    );
    blocks.push(
      `<details>\n<summary>${noun(notes.length)}</summary>\n\n${items.join("\n")}\n\n</details>`,
    );
  }
  return `${blocks.join("\n\n")}\n`;
}

function counts(entries: readonly ReportEntry[]): string {
  if (entries.length === 0) return "No changes to judge.";
  const n = (severity: string) => entries.filter((e) => e.severity === severity).length;
  return `${n("UNSAFE")} UNSAFE · ${n("RISKY")} RISKY · ${noun(n("SAFE"))}`;
}

function noun(safe: number): string {
  return `${safe} SAFE ${safe === 1 ? "note" : "notes"}`;
}

/** `file:line`; a whole-migration entry (line 0) is just the file. */
function where(e: ReportEntry): string {
  return e.line === 0 ? e.file : `${e.file}:${e.line}`;
}

function short(sha: string): string {
  return sha.slice(0, 7);
}
