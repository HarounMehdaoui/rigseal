// Normalizes a repo-relative POSIX path: no "./" in front, no "/" at the end, so equal paths compare equal.

/** `./prisma/migrations/` → `prisma/migrations`; "" is the repo root. */
export function normalizeRepoPath(path: string): string {
  return path.replace(/^(\.\/)+/, "").replace(/\/+$/, "");
}
