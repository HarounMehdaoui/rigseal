import { describe, expect, it } from "vitest";
import { renderText } from "./text.ts";

const BASE = { ref: "v1", sha: "aaaaaaa1111111", method: "tag" } as const;
const HEAD = { ref: "HEAD", sha: "bbbbbbb2222222" };

describe("renderText", () => {
  it("prints the verdict, base, head and one line per entry", () => {
    const text = renderText({
      verdict: "UNSAFE",
      base: BASE,
      head: HEAD,
      entries: [
        {
          ruleId: "RG-DB-002",
          severity: "UNSAFE",
          target: "User.name",
          reason: "base reads it",
          source: { kind: "statement", migration: "20261110000000_drop", line: 3, action: 0 },
        },
        {
          ruleId: "RG-DB-021",
          severity: "UNSAFE",
          target: "20261111000000_typo",
          reason: "does not parse",
          source: { kind: "migration", migration: "20261111000000_typo" },
        },
      ],
    });
    expect(text).toBe(
      [
        "Rollback Gate: UNSAFE",
        "base: v1 (aaaaaaa, tag)",
        "head: HEAD (bbbbbbb)",
        "",
        "UNSAFE  RG-DB-002  User.name  20261110000000_drop:3  base reads it",
        "UNSAFE  RG-DB-021  20261111000000_typo  20261111000000_typo  does not parse",
        "",
      ].join("\n"),
    );
  });

  it("shows the fallback warning and says when nothing changed", () => {
    const text = renderText({
      verdict: "SAFE",
      base: { ref: "main", sha: "ccccccc333", method: "fallback", warning: "No tag found." },
      head: HEAD,
      entries: [],
    });
    expect(text).toBe(
      [
        "Rollback Gate: SAFE",
        "warning: No tag found.",
        "base: main (ccccccc, fallback)",
        "head: HEAD (bbbbbbb)",
        "",
        "No new migrations.",
        "",
      ].join("\n"),
    );
  });
});
