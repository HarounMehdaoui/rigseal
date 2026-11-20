// End to end (T6.3b): the north-star rename as four PRs and tagged releases; base found automatically → SAFE, RISKY, SAFE, SAFE.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo, type TestRepo } from "../src/git/test-repo.ts";
import type { ExpectedEntry } from "../src/scenario-files.ts";
import { treeFiles } from "../src/tree-files.ts";
import { runCli } from "./run-cli.ts";

const STEPS = ["rename-r1-expand", "rename-r2-switch", "rename-r3-retire", "rename-r4-contract"];
// v1.10.0 sorts before v1.9.0 as text: the last step only finds its base by version order (D35).
const TAGS = ["v1.8.0", "v1.9.0", "v1.10.0", "v1.11.0"];

const scenario = (name: string) => new URL(`../scenarios/${name}/`, import.meta.url);

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
});
afterEach(async () => {
  await repo.remove();
});

describe("the four-release rename through git", () => {
  it("judges each PR against the release before it, found by tag, like the scenarios", async () => {
    await repo.commit(
      "release before the rename",
      treeFiles(new URL("base/", scenario(STEPS[0] ?? ""))),
    );
    await repo.git("tag", "v1.7.0");

    const verdicts: string[] = [];
    for (const [i, name] of STEPS.entries()) {
      const expected = JSON.parse(
        readFileSync(new URL("expected.json", scenario(name)), "utf8"),
      ) as { verdict: string; entries: ExpectedEntry[] };
      const previous = i === 0 ? "v1.7.0" : (TAGS[i - 1] ?? "");

      // A PR: a branch off main whose head is the scenario's head.
      await repo.git("switch", "--quiet", "--create", `pr-${i + 1}`, "main");
      await repo.git("rm", "-r", "--quiet", "prisma");
      await repo.commit(name, treeFiles(new URL("head/", scenario(name))));

      // No --base and no --target: base is the newest release tag reachable from main (D5, D46).
      const { code, report } = await runCli(repo.dir, ["--head", `pr-${i + 1}`]);
      expect(report.base, name).toMatchObject({ ref: previous, method: "tag" });
      expect(code, name).toBe(report.verdict === "UNSAFE" ? 1 : 0);
      expect(report.verdict, name).toBe(expected.verdict);
      expect(
        report.entries.map((e) => [e.ruleId, e.severity, e.target, e.file]),
        name,
      ).toEqual(
        expected.entries.map((e) => [
          e.ruleId,
          e.severity,
          e.target,
          `prisma/migrations/${e.source.migration}/migration.sql`,
        ]),
      );
      verdicts.push(report.verdict);

      // Merge and release it.
      await repo.git("switch", "--quiet", "main");
      await repo.git("merge", "--quiet", "--ff-only", `pr-${i + 1}`);
      await repo.git("tag", TAGS[i] ?? "");
    }

    expect(verdicts).toEqual(["SAFE", "RISKY", "SAFE", "SAFE"]);
  });
});
