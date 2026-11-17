import { describe, expect, it } from "vitest";
import { parseSql } from "../parse.ts";
import { isSkipped } from "./skip-list.ts";

async function skipped(sql: string): Promise<boolean> {
  const result = await parseSql(sql);
  const node = result.kind === "parsed" ? result.statements[0]?.node : undefined;
  if (node === undefined) throw new Error(`no statement in ${sql}`);
  return isSkipped(node);
}

describe("isSkipped", () => {
  it.each(["BEGIN;", "START TRANSACTION;", "COMMIT;", 'CREATE SCHEMA IF NOT EXISTS "public";'])(
    "skips %s",
    async (sql) => {
      expect(await skipped(sql)).toBe(true);
    },
  );

  it.each([
    "ROLLBACK;",
    'CREATE SCHEMA "public";',
    'CREATE SCHEMA IF NOT EXISTS "audit";',
    'DROP TABLE "User";',
  ])("does not skip %s", async (sql) => {
    expect(await skipped(sql)).toBe(false);
  });
});
