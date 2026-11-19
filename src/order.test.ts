import { describe, expect, it } from "vitest";
import { sortEntries } from "./order.ts";
import type { Entry } from "./types.ts";

function at(
  migration: string,
  line: number,
  action: number,
  ruleId: string,
  target: string,
): Entry {
  return {
    ruleId,
    severity: "SAFE",
    target,
    reason: `${migration}:${line}:${action}`,
    source: { kind: "statement", migration, line, action },
  };
}

function whole(migration: string, ruleId: string): Entry {
  return {
    ruleId,
    severity: "RISKY",
    target: migration,
    reason: "whole",
    source: { kind: "migration", migration },
  };
}

// Already in D29 order: file (migration), line, rule ID, target, action.
const SORTED: Entry[] = [
  whole("20261101000000_init", "RG-DB-020"),
  at("20261101000000_init", 3, 0, "RG-DB-002", "User.a"),
  whole("20261102000000_next", "RG-DB-021"),
  at("20261102000000_next", 2, 1, "RG-DB-001", "Post"),
  at("20261102000000_next", 2, 0, "RG-DB-002", "User.b"),
  at("20261102000000_next", 2, 0, "RG-DB-005", "User.a"),
  at("20261102000000_next", 2, 0, "RG-DB-005", "User.c"),
  at("20261102000000_next", 2, 1, "RG-DB-005", "User.c"),
  at("20261102000000_next", 10, 0, "RG-DB-000", "Log"),
  at("20261110000000_later", 1, 0, "RG-DB-000", "X"),
];

/** A fixed pseudo-random shuffle (a seeded LCG), so the test is the same on every run. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

describe("sortEntries (D24, D29)", () => {
  it.each([1, 2, 3, 42, 2026])("gives the same order from a shuffled input (seed %i)", (seed) => {
    expect(sortEntries(shuffled(SORTED, seed))).toEqual(SORTED);
  });

  it("gives the same order from the reversed input", () => {
    expect(sortEntries([...SORTED].reverse())).toEqual(SORTED);
  });

  it("compares by code unit, not by locale: an uppercase target sorts before a lowercase one", () => {
    const lower = at("20261102000000_next", 2, 0, "RG-DB-002", "User.a");
    const upper = at("20261102000000_next", 2, 0, "RG-DB-002", "User.B");
    expect(sortEntries([lower, upper]).map((e) => e.target)).toEqual(["User.B", "User.a"]);
  });

  it("keeps duplicates", () => {
    const dup = at("20261102000000_next", 2, 0, "RG-DB-005", "User.a");
    expect(sortEntries([dup, dup])).toEqual([dup, dup]);
  });

  it("doesn't change its input", () => {
    const input = [...SORTED].reverse();
    const copy = [...input];
    sortEntries(input);
    expect(input).toEqual(copy);
  });
});
