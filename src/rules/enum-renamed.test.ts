import { describe, expect, it } from "vitest";
import type { RenameEnum } from "../types.ts";
import { enumRenamed } from "./enum-renamed.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "enum Role {\n  USER\n}\nmodel User {\n  id   Int  @id\n  role Role\n}\n";

function rename(enumName: string): RenameEnum {
  return { kind: "RenameEnum", enum: enumName, newName: "user_role", source: at(2) };
}

describe("RG-DB-017 · enum type renamed", () => {
  it("is UNSAFE for an enum base uses: base's queries cast to the old name", () => {
    const entry = enumRenamed(rename("Role"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-017", severity: "UNSAFE", target: "Role" });
    expect(entry.reason).toMatch(/CAST/);
    expect(entry.fix).toMatch(/@@map/);
  });

  it("gives a SAFE note for an enum base doesn't use", () => {
    expect(enumRenamed(rename("Kind"), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-017",
      severity: "SAFE",
    });
  });
});
