// Makes untrusted text safe to print: one line, with control characters (ANSI escapes included) shown as `\xNN`.

// Unicode category Cc = C0 controls, DEL and C1 controls: what a terminal may act on instead of printing.
const CONTROL = /\p{Cc}/gu;

export function terminalText(text: string): string {
  return text
    .replace(/\r?\n/g, " ")
    .replace(CONTROL, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}
