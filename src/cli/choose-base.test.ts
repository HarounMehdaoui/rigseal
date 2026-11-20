import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo, type TestRepo } from "../git/test-repo.ts";
import { chooseBase } from "./choose-base.ts";

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
});
afterEach(async () => {
  await repo.remove();
});

describe("chooseBase", () => {
  it("uses an explicit ref as it is, with method explicit", async () => {
    const first = await repo.commit("first");
    await repo.git("tag", "v9");
    await repo.commit("second");

    expect(await chooseBase(repo.dir, { kind: "explicit", ref: "HEAD~1" })).toEqual({
      ref: "HEAD~1",
      sha: first,
      method: "explicit",
    });
  });

  it("looks up the release tag otherwise", async () => {
    const released = await repo.commit("release");
    await repo.git("tag", "v1");
    await repo.commit("work");

    expect(await chooseBase(repo.dir, { kind: "tag", target: "main", pattern: "v*" })).toEqual({
      ref: "v1",
      sha: released,
      method: "tag",
    });
  });

  it("fails on an explicit ref that doesn't exist", async () => {
    await repo.commit("first");
    await expect(chooseBase(repo.dir, { kind: "explicit", ref: "nope" })).rejects.toMatchObject({
      code: "REF_NOT_FOUND",
    });
  });
});
