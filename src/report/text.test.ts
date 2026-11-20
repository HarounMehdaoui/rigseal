import { describe, expect, it } from "vitest";
import { emptyReport, mixedReport } from "./report-fixture.ts";
import { renderText } from "./text.ts";

describe("renderText", () => {
  it("matches the golden file for a mixed report", async () => {
    await expect(renderText(await mixedReport())).toMatchFileSnapshot("golden/mixed.txt.golden");
  });

  it("matches the golden file for an empty fallback report", async () => {
    await expect(renderText(await emptyReport())).toMatchFileSnapshot("golden/empty.txt.golden");
  });

  it("lists findings worst first, then SAFE notes one line each (D29, D51)", async () => {
    const text = renderText(await mixedReport());
    const unsafe = text.indexOf("UNSAFE  RG-DB-");
    const risky = text.indexOf("RISKY  RG-DB-");
    const notes = text.indexOf("SAFE notes:\n");
    expect(unsafe).toBeGreaterThan(-1);
    expect(unsafe).toBeLessThan(risky);
    expect(risky).toBeLessThan(notes);
    expect(text.slice(notes)).not.toContain("fix:");
  });
});
