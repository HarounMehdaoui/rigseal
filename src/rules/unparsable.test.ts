import { describe, expect, it } from "vitest";
import { parseSql } from "../sql/parse.ts";
import type { Unparsable } from "../types.ts";
import { unparsable } from "./unparsable.ts";

const SOURCE = { kind: "migration", migration: "20261117120000_broken" } as const;

describe("RG-DB-021 · unparsable SQL", () => {
  it("turns garbage SQL into an UNSAFE finding that quotes the parser's message", async () => {
    const result = await parseSql('ALTER TABLE "User" DROP COLUM "name";\n');
    if (result.kind !== "failure") throw new Error("expected a parse failure");
    const finding = unparsable({
      kind: "Unparsable",
      message: result.message,
      line: result.line,
      source: SOURCE,
    });
    expect(finding).toMatchObject({
      ruleId: "RG-DB-021",
      severity: "UNSAFE",
      target: "20261117120000_broken",
      source: SOURCE,
    });
    expect(finding.reason).toContain(result.message);
    expect(finding.reason).toContain("line 1");
    expect(finding.fix).toMatch(/Postgres/);
  });

  it("leaves the line out of the reason when the parser gives none", () => {
    const change: Unparsable = { kind: "Unparsable", message: "boom", line: null, source: SOURCE };
    const finding = unparsable(change);
    expect(finding.reason).toContain("boom");
    expect(finding.reason).not.toMatch(/line/);
  });
});
