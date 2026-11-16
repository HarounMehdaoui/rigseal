import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listDir, readFile } from "./read.ts";
import { makeRepo, type TestRepo } from "./test-repo.ts";

// One repo for the whole file: v1 has one migration, main has two, and the working tree is dirty.
let repo: TestRepo;
beforeAll(async () => {
  repo = await makeRepo();
  await repo.commit("release 1", {
    "prisma/schema.prisma": "// v1 schema\n",
    "prisma/migrations/001_init/migration.sql": "CREATE TABLE a ();\n",
    "prisma/migrations/migration_lock.toml": 'provider = "postgresql"\n',
  });
  await repo.git("tag", "v1");
  await repo.commit("release 2", {
    "prisma/schema.prisma": "// v2 schema\n",
    "prisma/migrations/002_more/migration.sql": "CREATE TABLE b ();\n",
  });
  await writeFile(join(repo.dir, "prisma/schema.prisma"), "// uncommitted edit\n");
});
afterAll(async () => {
  await repo.remove();
});

describe("readFile", () => {
  it("reads the file as it is at the ref, never the working tree", async () => {
    expect(await readFile(repo.dir, "v1", "prisma/schema.prisma")).toBe("// v1 schema\n");
    expect(await readFile(repo.dir, "main", "prisma/schema.prisma")).toBe("// v2 schema\n");
  });

  it("throws PATH_NOT_FOUND for a path missing at that ref", async () => {
    await expect(
      readFile(repo.dir, "v1", "prisma/migrations/002_more/migration.sql"),
    ).rejects.toMatchObject({ name: "GitError", code: "PATH_NOT_FOUND" });
  });

  it("throws NOT_A_FILE for a folder", async () => {
    await expect(readFile(repo.dir, "main", "prisma/migrations")).rejects.toMatchObject({
      code: "NOT_A_FILE",
    });
  });

  it("throws REF_NOT_FOUND for an unknown ref", async () => {
    await expect(readFile(repo.dir, "v404", "prisma/schema.prisma")).rejects.toMatchObject({
      code: "REF_NOT_FOUND",
    });
  });
});

describe("listDir", () => {
  it("lists the folder's direct entries at the ref, with their kind", async () => {
    expect(await listDir(repo.dir, "v1", "prisma/migrations")).toEqual([
      { name: "001_init", kind: "dir" },
      { name: "migration_lock.toml", kind: "file" },
    ]);
    expect(await listDir(repo.dir, "main", "prisma/migrations/")).toEqual([
      { name: "001_init", kind: "dir" },
      { name: "002_more", kind: "dir" },
      { name: "migration_lock.toml", kind: "file" },
    ]);
  });

  it("throws PATH_NOT_FOUND for a folder missing at that ref", async () => {
    await expect(listDir(repo.dir, "main", "prisma/nope")).rejects.toMatchObject({
      code: "PATH_NOT_FOUND",
    });
  });

  it("throws NOT_A_DIRECTORY for a file", async () => {
    await expect(listDir(repo.dir, "main", "prisma/schema.prisma")).rejects.toMatchObject({
      code: "NOT_A_DIRECTORY",
    });
  });

  it("throws REF_NOT_FOUND for an unknown ref", async () => {
    await expect(listDir(repo.dir, "v404", "prisma")).rejects.toMatchObject({
      code: "REF_NOT_FOUND",
    });
  });
});
