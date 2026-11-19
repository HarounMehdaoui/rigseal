import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { UsedSet } from "../../schema/types.ts";
import { buildUsedSet } from "../../schema/used-set.ts";
import type { Change } from "../../types.ts";
import { migrationChanges } from "../migration-changes.ts";
import { recognizeEnumRecreate } from "./enum-recreate.ts";

const PRISMA = readFileSync(new URL("./fixtures/remove-enum-value.sql", import.meta.url), "utf8");

/** Base's schema: Role with the given values, on three columns (one with a default, one a list). */
function base(values: readonly string[]): UsedSet {
  return buildUsedSet(
    `datasource db {\n  provider = "postgresql"\n}\nenum Role {\n${values.map((v) => `  ${v}\n`).join("")}}\n` +
      "model User {\n  id    Int    @id\n  role  Role   @default(USER)\n  roles Role[]\n  other Role?\n}\n",
  );
}

const BASE_ROLE = ["ADMIN", "USER", "GUEST"];

async function changesOf(sql: string): Promise<Change[]> {
  return migrationChanges("3_drop_guest", sql);
}

describe("recognizeEnumRecreate", () => {
  it("turns Prisma's exact sequence into one RemoveEnumValue per value base has and the new list doesn't", async () => {
    const changes = await changesOf(PRISMA);
    expect(recognizeEnumRecreate(changes, base(BASE_ROLE))).toEqual([
      {
        kind: "RemoveEnumValue",
        enum: "Role",
        value: "GUEST",
        source: { kind: "statement", migration: "3_drop_guest", line: 4, action: 0 },
      },
    ]);
  });

  it("gives one change per removed value", async () => {
    const removed = recognizeEnumRecreate(
      await changesOf(PRISMA),
      base(["ADMIN", "USER", "GUEST", "OWNER"]),
    );
    expect(removed.map((c) => c.kind === "RemoveEnumValue" && c.value)).toEqual(["GUEST", "OWNER"]);
  });

  it("keeps the changes before and after the sequence", async () => {
    const sql = `ALTER TABLE "User" ADD COLUMN "x" TEXT;\n${PRISMA}\nDROP TABLE "Log";\n`;
    const kinds = recognizeEnumRecreate(await changesOf(sql), base(BASE_ROLE)).map((c) => c.kind);
    expect(kinds).toEqual(["AddColumn", "RemoveEnumValue", "DropTable"]);
  });

  it.each([
    ["DROP TYPE missing", 'DROP TYPE "Role_old";\n'],
    ["a renamed step missing", 'ALTER TYPE "Role_new" RENAME TO "Role";\n'],
    [
      "the default never restored",
      'ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT \'USER\';\n',
    ],
    [
      "a column's type change missing",
      'ALTER TABLE "User" ALTER COLUMN "other" TYPE "Role_new" USING ("other"::text::"Role_new");\n',
    ],
  ])(
    "leaves a partial sequence (%s) as separate changes, so RG-DB-008/017 fail closed",
    async (_why, line) => {
      expect(PRISMA).toContain(line);
      const changes = await changesOf(PRISMA.replace(line, ""));
      expect(recognizeEnumRecreate(changes, base(BASE_ROLE))).toEqual(changes);
    },
  );

  it("leaves the sequence alone when base doesn't use the enum (every change is then a SAFE note)", async () => {
    const changes = await changesOf(PRISMA);
    const unused = buildUsedSet(
      'datasource db {\n  provider = "postgresql"\n}\nmodel T {\n  id Int @id\n}\n',
    );
    expect(recognizeEnumRecreate(changes, unused)).toEqual(changes);
  });
});
