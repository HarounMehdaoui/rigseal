// End to end: the lab's history, v1 tagged `lab-v1`, v2 on a PR branch → UNSAFE (RG-DB-002 + RG-DB-005).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo, type TestRepo } from "../src/git/test-repo.ts";
import { treeFiles } from "../src/tree-files.ts";
import { runCli } from "./run-cli.ts";

/** The lab at v1: this scenario's base holds exactly its files. */
const V1 = new URL("../scenarios/lab-backfill-hand-edit/base/", import.meta.url);
/** v2 is the lab itself, as committed: schema, both migrations and migration_lock.toml. */
const V2 = new URL("../lab/prisma/", import.meta.url);

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
});
afterEach(async () => {
  await repo.remove();
});

describe("the lab through git", () => {
  it("finds what breaks v1 on the v2 database: the dropped column and the required columns", async () => {
    const v1 = await repo.commit("lab v1", treeFiles(V1));
    await repo.git("tag", "lab-v1");
    await repo.git("switch", "--quiet", "--create", "lab-v2");
    await repo.git("rm", "-r", "--quiet", "prisma");
    await repo.commit("lab v2: fullName + phone", treeFiles(V2, "prisma/"));

    const { code, report } = await runCli(repo.dir, [
      "--head",
      "lab-v2",
      "--tag-pattern",
      "lab-v*",
    ]);

    expect(code).toBe(1);
    expect(report.base).toEqual({ ref: "lab-v1", sha: v1, method: "tag" });
    expect(report.verdict).toBe("UNSAFE");
    const file = "prisma/migrations/20261116130000_fullname_phone/migration.sql";
    expect(report.entries.map((e) => [e.severity, e.ruleId, e.target, e.file])).toEqual([
      // Against the real database, v1's list fails with P2022 on User.name.
      ["UNSAFE", "RG-DB-002", "User.name", file],
      // v1's inserts can't supply these: NOT NULL violation (P2011), masked by the P2022 above in v2.
      ["UNSAFE", "RG-DB-005", "User.fullName", file],
      ["UNSAFE", "RG-DB-005", "User.phone", file],
      // The hand-edit's DROP DEFAULTs: judged by RG-DB-005 above, so only notes here.
      ["SAFE", "RG-DB-011", "User.fullName", file],
      ["SAFE", "RG-DB-011", "User.phone", file],
    ]);
  });
});
