import { describe, expect, it } from "vitest";
import { editedMigrations } from "./edited-migrations.ts";
import { diffHistory, type MigrationFolder } from "./history.ts";

const INIT = 'CREATE TABLE "User" (\n    "id" SERIAL NOT NULL\n);\n';
const PHONE = 'ALTER TABLE "User" ADD COLUMN "phone" TEXT;\n';

function folder(name: string, sql: string): MigrationFolder {
  return { name, sql };
}

describe("editedMigrations", () => {
  it("turns modified and removed migrations into EditedMigration changes, and nothing else", () => {
    const history = diffHistory(
      [folder("1_init", INIT), folder("2_phone", PHONE), folder("3_same", "SELECT 1;")],
      [folder("1_init", `${INIT}-- edited\n`), folder("3_same", "SELECT 1;"), folder("4_new", "")],
    );
    expect(editedMigrations(history)).toEqual([
      {
        kind: "EditedMigration",
        edit: "modified",
        source: { kind: "migration", migration: "1_init" },
      },
      {
        kind: "EditedMigration",
        edit: "removed",
        source: { kind: "migration", migration: "2_phone" },
      },
    ]);
  });
});
