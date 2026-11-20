// Test support: two reports built from real snapshots through analyze, with fixed SHAs, for the golden files.
import { analyze } from "../analyze.ts";
import { buildReport } from "./build-report.ts";
import type { Report } from "./types.ts";

const DATASOURCE = 'datasource db {\n  provider = "postgresql"\n}\n';

const SCHEMA = `${DATASOURCE}
model User {
  id   Int    @id @default(autoincrement())
  name String
}

model Post {
  id Int @id @default(autoincrement())
}
`;

const INIT = {
  name: "20261101000000_init",
  sql: `CREATE TABLE "User" ("id" SERIAL NOT NULL, "name" TEXT NOT NULL, CONSTRAINT "User_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Post" ("id" SERIAL NOT NULL, CONSTRAINT "Post_pkey" PRIMARY KEY ("id"));
`,
};

/**
 * Covers every layout case: UNSAFE, RISKY and SAFE entries; a whole-migration entry (line 0) from
 * an edited and an unparsable migration; and a table name full of Markdown syntax, for escaping.
 */
export async function mixedReport(): Promise<Report> {
  const base = {
    schema: SCHEMA,
    migrations: [INIT, { name: "20261105000000_seed", sql: "-- seed\n" }],
  };
  const head = {
    schema: SCHEMA,
    migrations: [
      INIT,
      { name: "20261105000000_seed", sql: "-- seed, edited after release\n" },
      {
        name: "20261110000000_cleanup",
        sql: `CREATE INDEX "User_id_idx" ON "User"("id");
ALTER TABLE "User" DROP COLUMN "name";
DELETE FROM "Post";
DROP TABLE "odd\`|<b>*_name";
`,
      },
      { name: "20261111000000_typo", sql: 'ALTR TABLE "User" ADD COLUMN "x" TEXT;\n' },
    ],
  };
  return buildReport({
    version: "0.0.0",
    base: { ref: "v1.0.0", sha: "1".repeat(40), method: "tag" },
    head: { ref: "HEAD", sha: "2".repeat(40) },
    migrationsDir: "prisma/migrations",
    analysis: await analyze(base, head),
  });
}

/** SAFE with no entries: no tag found (fallback) and a base schema with no models. */
export async function emptyReport(): Promise<Report> {
  const side = { schema: DATASOURCE, migrations: [] };
  return buildReport({
    version: "0.0.0",
    base: {
      ref: "main",
      sha: "3".repeat(40),
      method: "fallback",
      warning: 'No tag matching "v*" is reachable from "main", so base is "main" itself.',
    },
    head: { ref: "HEAD", sha: "4".repeat(40) },
    migrationsDir: "prisma/migrations",
    analysis: await analyze(side, side),
  });
}
