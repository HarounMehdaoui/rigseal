import { describe, expect, it } from "vitest";

// Proves the toolchain works end to end: Vitest runs a strict TypeScript test on Node 26.
describe("toolchain", () => {
  it("runs on Node 26 or newer (.nvmrc)", () => {
    const major = Number(process.versions.node.split(".")[0]);
    expect(major).toBeGreaterThanOrEqual(26);
  });

  it("knows the three verdicts", () => {
    const verdicts: readonly string[] = ["SAFE", "RISKY", "UNSAFE"];
    expect(verdicts).toEqual(["SAFE", "RISKY", "UNSAFE"]);
  });
});
