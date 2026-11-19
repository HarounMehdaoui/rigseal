// Locale-independent string order (plain UTF-16 code units), so sorted output is identical on every machine.

export function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}
