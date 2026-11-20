import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args.ts";
import { UsageError } from "./usage-error.ts";

const DEFAULTS = {
  head: "HEAD",
  base: { kind: "tag", target: "main", pattern: "v*" },
  schema: "prisma/schema.prisma",
  migrations: "prisma/migrations",
  failOn: "unsafe",
};

describe("parseCliArgs", () => {
  it("fills every default when no flag is given", () => {
    expect(parseCliArgs([])).toEqual({ kind: "run", options: DEFAULTS });
  });

  it("reads every flag", () => {
    const parsed = parseCliArgs([
      "--head=feature",
      "--target",
      "release",
      "--tag-pattern",
      "release-*",
      "--schema",
      "db/schema.prisma",
      "--migrations",
      "db/migrations",
      "--fail-on",
      "risky",
      "--json",
      "out/report.json",
      "--markdown",
      "out/report.md",
    ]);
    expect(parsed).toEqual({
      kind: "run",
      options: {
        head: "feature",
        base: { kind: "tag", target: "release", pattern: "release-*" },
        schema: "db/schema.prisma",
        migrations: "db/migrations",
        failOn: "risky",
        json: "out/report.json",
        markdown: "out/report.md",
      },
    });
  });

  it("takes an explicit base instead of the tag lookup", () => {
    expect(parseCliArgs(["--base", "v1.2.0"])).toEqual({
      kind: "run",
      options: { ...DEFAULTS, base: { kind: "explicit", ref: "v1.2.0" } },
    });
  });

  it("asks for help with --help or -h", () => {
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ kind: "help" });
  });

  it.each([
    [["--base", "v1", "--target", "main"], /--base.*--target/],
    [["--base", "v1", "--tag-pattern", "v*"], /--base.*--tag-pattern/],
    [["--fail-on", "safe"], /--fail-on.*"risky" or "unsafe"/],
    [["--base", ""], /--base.*empty/],
    [["--json", ""], /--json.*empty/],
    [["--nope"], /--nope/],
    [["main"], /main/],
    [["--base"], /--base/],
  ])("rejects %j with a UsageError", (argv, message) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
    expect(() => parseCliArgs(argv)).toThrow(message);
  });
});
