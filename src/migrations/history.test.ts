import { describe, expect, it } from "vitest";
import { editedMigration } from "../rules/edited-migration.ts";
import { diffHistory, editedMigrations, fingerprint, type MigrationFolder } from "./history.ts";

const INIT = 'CREATE TABLE "User" (\n    "id" SERIAL NOT NULL,\n    "name" TEXT NOT NULL\n);\n';
const PHONE = 'ALTER TABLE "User" ADD COLUMN "phone" TEXT;\n';

function folder(name: string, sql: string): MigrationFolder {
  return { name, sql };
}

function findings(base: MigrationFolder[], head: MigrationFolder[]) {
  return editedMigrations(diffHistory(base, head)).map(editedMigration);
}

describe("fingerprint (D19)", () => {
  it("hashes the same content with LF and with CRLF identically", () => {
    const crlf = INIT.replaceAll("\n", "\r\n");
    expect(crlf).not.toBe(INIT);
    expect(fingerprint(crlf)).toBe(fingerprint(INIT));
  });

  it("is the SHA-256 of the LF content, as Prisma's own checksum is", () => {
    expect(fingerprint("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(fingerprint("a\r\nb")).toBe(fingerprint("a\nb"));
    expect(fingerprint(INIT)).not.toBe(fingerprint(PHONE));
  });
});

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
    expect(editedMigrations(history)).toEqual([]);
  });
});

describe("RG-DB-020 · edited or removed migration", () => {
  it("gives a RISKY finding when a released migration was modified", () => {
    const [finding, ...rest] = findings(
      [folder("1_init", INIT)],
      [folder("1_init", `${INIT}ALTER TABLE "User" DROP COLUMN "name";\n`)],
    );
    expect(rest).toEqual([]);
    expect(finding).toMatchObject({
      ruleId: "RG-DB-020",
      severity: "RISKY",
      target: "1_init",
      source: { kind: "migration", migration: "1_init" },
    });
    expect(finding?.reason).toMatch(/edited/);
    expect(finding?.fix).toMatch(/new migration/);
  });

  it("gives a RISKY finding when a released migration was removed", () => {
    const [finding, ...rest] = findings(
      [folder("1_init", INIT), folder("2_phone", PHONE)],
      [folder("1_init", INIT)],
    );
    expect(rest).toEqual([]);
    expect(finding).toMatchObject({
      ruleId: "RG-DB-020",
      severity: "RISKY",
      target: "2_phone",
      source: { kind: "migration", migration: "2_phone" },
    });
    expect(finding?.reason).toMatch(/removed/);
  });

  it("gives no entry for new or unchanged migrations", () => {
    expect(
      findings([folder("1_init", INIT)], [folder("1_init", INIT), folder("2_phone", PHONE)]),
    ).toEqual([]);
  });
});
