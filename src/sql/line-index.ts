// Maps a position in SQL text (a UTF-8 byte offset or a code-point index) to its 1-based line number.

const NEWLINE = 0x0a;

/**
 * Builds a lookup from UTF-8 byte offset to line, for many offsets into the same text. The table of
 * line starts is built once, then each lookup is a binary search: a data migration with thousands of
 * statements stays fast. CRLF needs nothing special: only `\n` starts a line.
 */
export function byteOffsetToLine(sql: string): (offset: number) => number {
  const bytes = new TextEncoder().encode(sql);
  const lineStarts = [0];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === NEWLINE) lineStarts.push(i + 1);
  }
  return (offset) => countAtOrBelow(lineStarts, offset);
}

/** The line holding the code point at `index` (0-based). `for…of` walks code points, not UTF-16. */
export function codePointToLine(sql: string, index: number): number {
  let line = 1;
  let position = 0;
  for (const char of sql) {
    if (position === index) break;
    if (char === "\n") line++;
    position++;
  }
  return line;
}

/** How many sorted values are ≤ `target`: the 1-based line whose start is the last one ≤ target. */
function countAtOrBelow(sorted: readonly number[], target: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if ((sorted[mid] ?? Number.POSITIVE_INFINITY) <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}
