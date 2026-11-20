import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toolVersion } from "./tool-version.ts";

describe("toolVersion", () => {
  it("is package.json's version", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(toolVersion()).toBe(pkg.version);
  });
});
