import { describe, expect, it } from "vitest";
import type { AddEnumValue } from "../types.ts";
import { enumValueAdded } from "./enum-value-added.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE =
  'enum Role {\n  USER\n  @@map("user_role")\n}\nenum Unused {\n  A\n}\nmodel User {\n  id   Int  @id\n  role Role\n}\n';

function add(enumName: string): AddEnumValue {
  return { kind: "AddEnumValue", enum: enumName, value: "GUEST", source: at(2) };
}

describe("RG-DB-015 · enum value added", () => {
  it("is RISKY for an enum base uses (by its database name)", () => {
    const entry = enumValueAdded(add("user_role"), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-015", severity: "RISKY", target: "user_role" });
    expect(entry.reason).toMatch(/P2023/);
    expect(entry.fix).toMatch(/without writing it/);
  });

  it("gives a SAFE note for an enum no used column has", () => {
    expect(enumValueAdded(add("Unused"), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-015",
      severity: "SAFE",
    });
  });
});
