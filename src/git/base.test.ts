import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveBase } from "./base.ts";
import { makeRepo, type TestRepo } from "./test-repo.ts";

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
});
afterEach(async () => {
  await repo.remove();
});

describe("resolveBase", () => {
  it("picks the release tag reachable from the target", async () => {
    const released = await repo.commit("release 1");
    await repo.git("tag", "v1");
    await repo.commit("work after the release");

    expect(await resolveBase(repo.dir, "main", "v*")).toEqual({
      ref: "v1",
      sha: released,
      method: "tag",
    });
  });

  it("ignores a newer tag that only exists on another branch", async () => {
    const released = await repo.commit("release 1");
    await repo.git("tag", "v1");
    await repo.git("switch", "--quiet", "--create", "feature");
    await repo.commit("unmerged work");
    await repo.git("tag", "v2");
    await repo.git("switch", "--quiet", "main");
    await repo.commit("main moves on");

    const base = await resolveBase(repo.dir, "main", "v*");
    expect(base).toMatchObject({ ref: "v1", sha: released, method: "tag" });
  });

  it("falls back to the target itself, with a warning, when no tag matches", async () => {
    const head = await repo.commit("never released");

    expect(await resolveBase(repo.dir, "main", "v*")).toEqual({
      ref: "main",
      sha: head,
      method: "fallback",
      warning: expect.stringContaining('No tag matching "v*" is reachable from "main"'),
    });
  });

  it("throws a typed error for an unknown target", async () => {
    await repo.commit("anything");

    await expect(resolveBase(repo.dir, "no-such-branch", "v*")).rejects.toMatchObject({
      name: "GitError",
      code: "REF_NOT_FOUND",
    });
  });

  describe("which tag is latest", () => {
    it("prefers the highest version over a hotfix tag merged back later", async () => {
      await repo.commit("release 1.0.0");
      await repo.git("tag", "v1.0.0");
      await repo.git("switch", "--quiet", "--create", "hotfix");
      await repo.commit("fix");
      await repo.git("tag", "v1.0.1");
      await repo.git("switch", "--quiet", "main");
      const v2 = await repo.commit("release 2.0.0");
      await repo.git("tag", "v2.0.0");
      await repo.git("merge", "--quiet", "--no-ff", "--no-edit", "hotfix");

      expect(await resolveBase(repo.dir, "main", "v*")).toMatchObject({ ref: "v2.0.0", sha: v2 });
    });

    it("sorts a prerelease below its release", async () => {
      await repo.commit("release 2.0.0");
      await repo.git("tag", "v2.0.0-rc.1");
      await repo.git("tag", "v2.0.0");

      expect(await resolveBase(repo.dir, "main", "v*")).toMatchObject({ ref: "v2.0.0" });
    });

    it("compares versions as numbers, not text (v10 > v9)", async () => {
      await repo.commit("release 9");
      await repo.git("tag", "v9.0.0");
      await repo.commit("release 10");
      await repo.git("tag", "v10.0.0");

      expect(await resolveBase(repo.dir, "main", "v*")).toMatchObject({ ref: "v10.0.0" });
    });
  });

  it("only considers tags matching the pattern", async () => {
    const released = await repo.commit("release 5");
    await repo.git("tag", "release-5");
    await repo.commit("experiment");
    await repo.git("tag", "v99-experiment");

    expect(await resolveBase(repo.dir, "main", "release-*")).toMatchObject({
      ref: "release-5",
      sha: released,
    });
  });

  it("returns the commit SHA for an annotated tag, not the tag object's", async () => {
    const released = await repo.commit("release 1");
    await repo.git("tag", "--annotate", "v1", "--message", "Release 1");

    expect(await resolveBase(repo.dir, "main", "v*")).toMatchObject({ sha: released });
  });
});
