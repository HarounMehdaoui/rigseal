import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint.ts";
import { diffHistory, type MigrationFolder } from "./history.ts";

const INIT = 'CREATE TABLE "User" (\n    "id" SERIAL NOT NULL,\n    "name" TEXT NOT NULL\n);\n';
const PHONE = 'ALTER TABLE "User" ADD COLUMN "phone" TEXT;\n';

function folder(name: string, sql: string): MigrationFolder {
  return { name, sql };
}

describe("diffHistory", () => {
  it("classifies each folder as new, unchanged, modified or removed, sorted by name", () => {
    const base = [folder("2_phone", PHONE), folder("1_init", INIT), folder("3_gone", "SELECT 1;")];
    const head = [
      folder("1_init", INIT),
      folder("2_phone", `${PHONE}-- edited\n`),
      folder("4_new", "SELECT 2;"),
    ];
    expect(diffHistory(base, head).map((h) => [h.name, h.status])).toEqual([
      ["1_init", "unchanged"],
      ["2_phone", "modified"],
      ["3_gone", "removed"],
      ["4_new", "new"],
    ]);
  });

  it("records each side's fingerprint, null where the migration is absent", () => {
    const [removed, added] = diffHistory([folder("1_a", INIT)], [folder("2_b", PHONE)]);
    expect(removed).toEqual({
      name: "1_a",
      status: "removed",
      base: fingerprint(INIT),
      head: null,
    });
    expect(added).toEqual({ name: "2_b", status: "new", base: null, head: fingerprint(PHONE) });
  });

  it("treats a line-ending-only change as unchanged, not as an edit", () => {
    const history = diffHistory(
      [folder("1_init", INIT)],
      [folder("1_init", INIT.replaceAll("\n", "\r\n"))],
    );
    expect(history.map((h) => h.status)).toEqual(["unchanged"]);
  });
});
