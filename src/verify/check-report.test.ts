import { describe, expect, it } from "vitest";
import { checkReport } from "./check-report.ts";
import { Refusal } from "./refusal.ts";

const SHA = "a".repeat(40);

function report(fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    tool: { name: "rigseal", version: "0.2.0" },
    verdict: "SAFE",
    head: { ref: "HEAD", sha: SHA },
    ...fields,
  });
}

describe("checkReport", () => {
  it("allows a SAFE or RISKY report about the deploy commit, and returns the verdict", () => {
    expect(checkReport(report(), SHA, "unsafe")).toBe("SAFE");
    expect(checkReport(report({ verdict: "RISKY" }), SHA, "unsafe")).toBe("RISKY");
  });

  it("accepts a report signed before the rename, when the tool was called rollback-gate", () => {
    expect(
      checkReport(report({ tool: { name: "rollback-gate", version: "0.3.0" } }), SHA, "unsafe"),
    ).toBe("SAFE");
  });

  it("refuses UNSAFE", () => {
    expect(() => checkReport(report({ verdict: "UNSAFE" }), SHA, "unsafe")).toThrow(
      /verdict is UNSAFE/,
    );
  });

  it("refuses RISKY with fail-on risky", () => {
    expect(() => checkReport(report({ verdict: "RISKY" }), SHA, "risky")).toThrow(
      /verdict is RISKY/,
    );
  });

  it("refuses a report about another commit", () => {
    const other = "b".repeat(40);
    expect(() => checkReport(report({ head: { ref: "HEAD", sha: other } }), SHA, "unsafe")).toThrow(
      new RegExp(`about commit ${other}, not the deploy commit ${SHA}`),
    );
  });

  it.each([
    ["not JSON", "{"],
    ["not an object", "[]"],
    ["another schema version", report({ schemaVersion: 2 })],
    ["another tool", report({ tool: { name: "other", version: "1" } })],
    ["no head SHA", report({ head: {} })],
    ["an unknown verdict", report({ verdict: "FINE" })],
  ])("refuses %s", (_, text) => {
    expect(() => checkReport(text, SHA, "unsafe")).toThrow(Refusal);
  });
});
