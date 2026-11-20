import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitError } from "./errors.ts";
import { readSnapshot } from "./snapshot.ts";
import { makeRepo, type TestRepo } from "./test-repo.ts";

const PATHS = { schema: "prisma/schema.prisma", migrations: "prisma/migrations" };

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
});
afterEach(async () => {
  await repo.remove();
});

describe("readSnapshot", () => {
  it("reads the schema and every migration folder's SQL at the ref, skipping plain files", async () => {
    const sha = await repo.commit("release", {
      "prisma/schema.prisma": "model A { id Int @id }\n",
      "prisma/migrations/migration_lock.toml": 'provider = "postgresql"\n',
      "prisma/migrations/20261101000000_init/migration.sql": "CREATE TABLE a ();\n",
      "prisma/migrations/20261102000000_more/migration.sql": "CREATE TABLE b ();\n",
    });
    // Later work in the working tree and in a new commit must not leak into the snapshot.
    await repo.commit("later", { "prisma/schema.prisma": "changed\n" });

    expect(await readSnapshot(repo.dir, sha, PATHS)).toEqual({
      schema: "model A { id Int @id }\n",
      migrations: [
        { name: "20261101000000_init", sql: "CREATE TABLE a ();\n" },
        { name: "20261102000000_more", sql: "CREATE TABLE b ();\n" },
      ],
    });
  });

  it("reads a missing migrations folder as no migrations", async () => {
    const sha = await repo.commit("first", { "prisma/schema.prisma": "x\n" });
    expect(await readSnapshot(repo.dir, sha, PATHS)).toEqual({ schema: "x\n", migrations: [] });
  });

  it("reads custom paths", async () => {
    const sha = await repo.commit("custom", {
      "db/schema.prisma": "s\n",
      "db/mig/1_init/migration.sql": "q\n",
    });
    expect(
      await readSnapshot(repo.dir, sha, { schema: "db/schema.prisma", migrations: "db/mig" }),
    ).toEqual({ schema: "s\n", migrations: [{ name: "1_init", sql: "q\n" }] });
  });

  it("fails on a missing schema", async () => {
    const sha = await repo.commit("no schema", { "README.txt": "hi\n" });
    await expect(readSnapshot(repo.dir, sha, PATHS)).rejects.toMatchObject({
      name: "GitError",
      code: "PATH_NOT_FOUND",
    });
  });

  it("fails on a migration folder without migration.sql", async () => {
    const sha = await repo.commit("broken", {
      "prisma/schema.prisma": "x\n",
      "prisma/migrations/20261101000000_init/notes.txt": "oops\n",
    });
    const read = readSnapshot(repo.dir, sha, PATHS);
    await expect(read).rejects.toThrow(GitError);
    await expect(read).rejects.toThrow(/20261101000000_init\/migration\.sql/);
  });

  it("fails when the migrations path is a file", async () => {
    const sha = await repo.commit("odd", {
      "prisma/schema.prisma": "x\n",
      "prisma/migrations": "not a folder\n",
    });
    await expect(readSnapshot(repo.dir, sha, PATHS)).rejects.toMatchObject({
      code: "NOT_A_DIRECTORY",
    });
  });

  it("fails on a symlink in the migrations folder rather than skip a migration", async () => {
    await repo.commit("target", {
      "prisma/schema.prisma": "x\n",
      "elsewhere/migration.sql": "q\n",
    });
    // A tree entry with mode 120000 is a symlink; its blob holds the link's target path.
    const blob = await repo.git("hash-object", "-w", "elsewhere/migration.sql");
    await repo.git(
      "update-index",
      "--add",
      "--cacheinfo",
      `120000,${blob},prisma/migrations/1_link`,
    );
    await repo.git("commit", "--quiet", "--message", "link");
    const sha = await repo.git("rev-parse", "HEAD");
    await expect(readSnapshot(repo.dir, sha, PATHS)).rejects.toThrow(/1_link/);
  });
});
