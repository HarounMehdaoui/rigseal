// Makes untrusted text safe inside Markdown: escaped prose, or a code span no backtick can break out of.

// Characters that can start emphasis, code, links, HTML, tables, headings or entities.
// CommonMark lets any ASCII punctuation be backslash-escaped; these are the ones that matter inline.
const SPECIAL = /[\\`*_{}[\]<>#|~&]/g;

// `@name` / `@@name`: GitHub turns it into a mention (and a notification) even when escaped.
const MENTION = /@+[\w-]+/g;

/**
 * One line of prose: newlines become spaces, so text from a PR can't start a heading or list.
 * Each `@word` becomes a code span, where GitHub never links mentions; that also suits Prisma
 * attributes like `@ignore`, which the rules' own fixes mention.
 */
export function escapeMarkdown(text: string): string {
  const line = oneLine(text);
  let out = "";
  let from = 0;
  for (const match of line.matchAll(MENTION)) {
    out += escapeSpecial(line.slice(from, match.index)) + codeSpan(match[0]);
    from = match.index + match[0].length;
  }
  return out + escapeSpecial(line.slice(from));
}

function escapeSpecial(text: string): string {
  return text.replace(SPECIAL, (c) => `\\${c}`);
}

/**
 * Inline code. Inside a span nothing is interpreted, so names stay exact; the fence is one
 * backtick longer than the longest run inside, and padded when the text touches a backtick.
 */
export function codeSpan(text: string): string {
  const line = oneLine(text);
  const longest = Math.max(0, ...(line.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = line.startsWith("`") || line.endsWith("`") ? " " : "";
  return `${fence}${pad}${line}${pad}${fence}`;
}

function oneLine(text: string): string {
  return text.replace(/\r?\n/g, " ");
}
