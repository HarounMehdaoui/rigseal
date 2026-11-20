import { describe, expect, it } from "vitest";
import { renderJson } from "./json.ts";
import { emptyReport, mixedReport } from "./report-fixture.ts";
import type { Report } from "./types.ts";

describe("renderJson", () => {
  it("matches the golden file for a mixed report", async () => {
    await expect(renderJson(await mixedReport())).toMatchFileSnapshot("golden/mixed.json.golden");
  });

  it("matches the golden file for an empty fallback report", async () => {
    await expect(renderJson(await emptyReport())).toMatchFileSnapshot("golden/empty.json.golden");
  });

  it("writes keys in D49's order whatever order the report object has them in", async () => {
    const report = await mixedReport();
    const [entry] = report.entries;
    if (entry === undefined) throw new Error("fixture has entries");
    const shuffled = {
      entries: [Object.fromEntries(Object.entries(entry).reverse())],
      migrations: report.migrations.map((m) => ({
        sha256: m.sha256,
        status: m.status,
        file: m.file,
      })),
      warnings: report.warnings,
      head: { sha: report.head.sha, ref: report.head.ref },
      base: { method: report.base.method, sha: report.base.sha, ref: report.base.ref },
      verdict: report.verdict,
      tool: { version: report.tool.version, name: report.tool.name },
      schemaVersion: report.schemaVersion,
    } as unknown as Report;
    const ordered = { ...report, entries: [entry] };

    expect(renderJson(shuffled)).toBe(renderJson(ordered));
  });

  it("uses 2-space indentation and ends with exactly one newline (D24)", async () => {
    const json = renderJson(await emptyReport());
    expect(json.startsWith('{\n  "schemaVersion": 1,\n')).toBe(true);
    expect(json.endsWith("}\n")).toBe(true);
    expect(json.endsWith("\n\n")).toBe(false);
  });

  it("drops anything that isn't part of the format", async () => {
    const report = { ...(await emptyReport()), extra: "no" } as Report;
    expect(renderJson(report)).not.toContain("extra");
  });
});
