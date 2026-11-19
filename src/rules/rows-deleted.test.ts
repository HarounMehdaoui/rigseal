import { describe, expect, it } from "vitest";
import type { DeleteRows } from "../types.ts";
import { rowsDeleted } from "./rows-deleted.ts";
import { at, contextFor } from "./rule-test-support.ts";

const BASE = "model Role {\n  id Int @id\n}\n";

function remove(table: string, via: DeleteRows["via"]): DeleteRows {
  return { kind: "DeleteRows", table, via, source: at(2) };
}

describe("RG-DB-019 · rows deleted", () => {
  it.each(["delete", "truncate"] as const)("is RISKY for %s on a table base uses", (via) => {
    const entry = rowsDeleted(remove("Role", via), contextFor(BASE));
    expect(entry).toMatchObject({ ruleId: "RG-DB-019", severity: "RISKY", target: "Role" });
    expect(entry.reason).toMatch(/expects the deleted rows/);
    expect(entry.fix).toMatch(/soft-delete/i);
  });

  it("gives a SAFE note on a table base doesn't use", () => {
    expect(rowsDeleted(remove("Log", "delete"), contextFor(BASE))).toMatchObject({
      ruleId: "RG-DB-019",
      severity: "SAFE",
    });
  });
});
