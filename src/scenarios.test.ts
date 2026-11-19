// Scenario tests: each folder under scenarios/ runs through the pure core with no git (PLAN §5, D41).
// The north star (T4.1) is the four-release rename from RULES §5, expecting SAFE, RISKY, SAFE, SAFE.
// While its rules were missing it ran as `it.fails` (D39); since T5.1 every scenario is a normal test.
import { describe, expect, it } from "vitest";
import { analyze } from "./analyze.ts";
import { loadScenario, scenarioNames } from "./scenario-files.ts";
import { buildUsedSet } from "./schema/used-set.ts";
import { parseSql } from "./sql/parse.ts";
import { verdictOf } from "./verdict.ts";

const NORTH_STAR = [
  "rename-r1-expand",
  "rename-r2-switch",
  "rename-r3-retire",
  "rename-r4-contract",
];

describe("scenario inputs are sound", () => {
  it.each(scenarioNames())("%s: both schemas read and every migration parses", async (name) => {
    const { base, head } = loadScenario(name);
    buildUsedSet(base.schema);
    buildUsedSet(head.schema);
    for (const { name: migration, sql } of [...base.migrations, ...head.migrations]) {
      const parsed = await parseSql(sql);
      expect(parsed.kind, `${migration} should parse`).toBe("parsed");
    }
  });

  it("has the four north-star scenarios", () => {
    expect(scenarioNames()).toEqual(expect.arrayContaining(NORTH_STAR));
  });
});

async function run(name: string) {
  const { base, head, expected } = loadScenario(name);
  const entries = await analyze(base, head);
  const actual = {
    verdict: verdictOf(entries),
    entries: entries.map(({ ruleId, severity, target, source }) => ({
      ruleId,
      severity,
      target,
      source,
    })),
  };
  expect(actual).toEqual(expected);
}

describe("scenarios", () => {
  it.each(scenarioNames())("%s", run);
});
