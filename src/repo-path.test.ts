import { describe, expect, it } from "vitest";
import { normalizeRepoPath } from "./repo-path.ts";

describe("normalizeRepoPath", () => {
  it.each([
    ["prisma/migrations", "prisma/migrations"],
    ["./prisma/migrations/", "prisma/migrations"],
    ["././db//", "db"],
    [".", "."],
    ["./", ""],
    ["", ""],
  ])("%j → %j", (input, output) => {
    expect(normalizeRepoPath(input)).toBe(output);
  });
});
