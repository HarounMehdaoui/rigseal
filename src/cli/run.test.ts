import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeRepo, type TestRepo } from "../git/test-repo.ts";
import { run } from "./run.ts";

const SCHEMA = `datasource db {
  provider = "postgresql"
}

model User {
  id   Int    @id @default(autoincrement())
  name String
}
`;

const INIT = `CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
`;

const RELEASE = {
  "prisma/schema.prisma": SCHEMA,
  "prisma/migrations/20261101000000_init/migration.sql": INIT,
};

let repo: TestRepo;
beforeEach(async () => {
  repo = await makeRepo();
});
afterEach(async () => {
  await repo.remove();
});

async function release(): Promise<void> {
  await repo.commit("release", RELEASE);
  await repo.git("tag", "v1");
}

async function head(name: string, sql: string): Promise<void> {
  await repo.commit(name, { [`prisma/migrations/20261110000000_${name}/migration.sql`]: sql });
}

async function gate(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const files = new Map<string, string>();
  const code = await run(argv, {
    repo: repo.dir,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    writeFile: async (path, text) => {
      if (path.startsWith("forbidden/"))
        throw new Error(`EACCES: permission denied, open '${path}'`);
      files.set(path, text);
    },
  });
  return { code, stdout, stderr, files };
}

/** A tool failure: exit 2, nothing on stdout, exactly one line on stderr. */
function expectToolFailure(result: Awaited<ReturnType<typeof gate>>, message: RegExp): void {
  expect(result.code).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toMatch(/^rollback-gate: [^\n]+\n$/);
  expect(result.stderr).toMatch(message);
}

describe("run: verdicts and exit codes (D14)", () => {
  it("exits 0 on SAFE and names base and head", async () => {
    await release();
    await head("index", 'CREATE INDEX "User_name_idx" ON "User"("name");\n');

    const result = await gate();
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/^Rollback Gate: SAFE$/m);
    expect(result.stdout).toMatch(/base: v1 \([0-9a-f]{7}, tag\)/);
  });

  it("exits 1 on UNSAFE", async () => {
    await release();
    await head("drop", 'ALTER TABLE "User" DROP COLUMN "name";\n');

    const result = await gate();
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(/^Rollback Gate: UNSAFE$/m);
    expect(result.stdout).toMatch(/UNSAFE +RG-DB-002 +User\.name/);
  });

  it("exits 0 on RISKY, and 1 with --fail-on risky", async () => {
    await release();
    await head("purge", 'DELETE FROM "User";\n');

    expect((await gate()).code).toBe(0);
    expect((await gate("--fail-on", "risky")).code).toBe(1);
  });

  it("exits 1, not 2, on unparsable SQL (D20, RG-DB-021)", async () => {
    await release();
    await head("typo", 'ALTR TABLE "User" DROP COLUMN "name";\n');

    const result = await gate();
    expect(result.code).toBe(1);
    expect(result.stderr).toBe("");
    expect(result.stdout).toMatch(/UNSAFE +RG-DB-021/);
  });

  it("falls back to the target with a warning when no tag exists (D5)", async () => {
    await repo.commit("release", RELEASE);
    const result = await gate();
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/base: main \([0-9a-f]{7}, fallback\)/);
    expect(result.stdout).toMatch(/^warning: No tag matching "v\*"/m);
  });

  it("compares against an explicit --base (D47)", async () => {
    await repo.commit("release", RELEASE);
    await head("drop", 'ALTER TABLE "User" DROP COLUMN "name";\n');

    const result = await gate("--base", "HEAD~1");
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(/base: HEAD~1 \([0-9a-f]{7}, explicit\)/);
  });

  it("prints usage on --help and exits 0", async () => {
    const result = await gate("--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: rollback-gate/);
  });
});

describe("run: report files (D16, D49, D50)", () => {
  it("writes the JSON and Markdown reports where asked, and still prints the text", async () => {
    await release();
    await head("drop", 'ALTER TABLE "User" DROP COLUMN "name";\n');

    const result = await gate("--json", "out/r.json", "--markdown", "out/r.md");
    expect(result.code).toBe(1);
    expect([...result.files.keys()]).toEqual(["out/r.json", "out/r.md"]);
    const json = JSON.parse(result.files.get("out/r.json") ?? "");
    expect(json).toMatchObject({
      schemaVersion: 1,
      verdict: "UNSAFE",
      base: { ref: "v1", method: "tag" },
      entries: [
        {
          ruleId: "RG-DB-002",
          file: "prisma/migrations/20261110000000_drop/migration.sql",
          line: 1,
        },
      ],
    });
    expect(result.files.get("out/r.md")).toMatch(
      /^<!-- rollback-gate -->\n## Rollback Gate: 🔴 UNSAFE/,
    );
    expect(result.stdout).toMatch(/^Rollback Gate: UNSAFE$/m);
  });

  it("writes nothing when the tool fails", async () => {
    await release();
    const result = await gate("--base", "nope", "--json", "out/r.json");
    expect(result.code).toBe(2);
    expect(result.files.size).toBe(0);
  });

  it("exits 2 with one line, and prints no verdict, when a report can't be written", async () => {
    await release();
    expectToolFailure(
      await gate("--json", "forbidden/r.json"),
      /can't write the JSON report to forbidden\/r\.json: EACCES/,
    );
  });
});

describe("run: tool failures exit 2 with one line on stderr", () => {
  it("on a ref that doesn't exist", async () => {
    await release();
    expectToolFailure(await gate("--base", "nope"), /"nope" is not a branch, tag or commit/);
  });

  it("on a bad --head", async () => {
    await release();
    expectToolFailure(await gate("--head", "nope"), /"nope"/);
  });

  it("on a missing schema at base", async () => {
    await repo.commit("release", { "prisma/migrations/20261101000000_init/migration.sql": INIT });
    await repo.git("tag", "v1");
    expectToolFailure(await gate(), /prisma\/schema\.prisma" does not exist/);
  });

  it("on an invalid schema at base", async () => {
    await repo.commit("release", { ...RELEASE, "prisma/schema.prisma": "model User {\n" });
    await repo.git("tag", "v1");
    expectToolFailure(await gate(), /base schema\.prisma is invalid/);
  });

  it("on a usage error", async () => {
    expectToolFailure(await gate("--fail-on", "maybe"), /--fail-on.*see --help/);
  });

  it("outside a git repository", async () => {
    await repo.remove();
    expectToolFailure(await gate(), /git/);
  });
});
