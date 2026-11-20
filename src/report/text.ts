// Renders a run's result as plain text for the terminal: verdict, base, head, one line per entry (D45).
import type { BaseChoice } from "../cli/choose-base.ts";
import type { Entry, Severity, Source } from "../types.ts";

export interface TextInput {
  readonly verdict: Severity;
  readonly base: BaseChoice;
  readonly head: { readonly ref: string; readonly sha: string };
  readonly entries: readonly Entry[];
}

/** Minimal on purpose: T6.2 replaces it with the full text report (D45). */
export function renderText({ verdict, base, head, entries }: TextInput): string {
  const lines = [`Rollback Gate: ${verdict}`];
  if (base.method === "fallback") lines.push(`warning: ${base.warning}`);
  lines.push(`base: ${base.ref} (${short(base.sha)}, ${base.method})`);
  lines.push(`head: ${head.ref} (${short(head.sha)})`, "");

  if (entries.length === 0) lines.push("No new migrations.");
  for (const e of entries) {
    lines.push(`${e.severity}  ${e.ruleId}  ${e.target}  ${where(e.source)}  ${e.reason}`);
  }
  return `${lines.join("\n")}\n`;
}

function short(sha: string): string {
  return sha.slice(0, 7);
}

function where(source: Source): string {
  return source.kind === "statement" ? `${source.migration}:${source.line}` : source.migration;
}
