import { describe, expect, it } from "vitest";
import { UsageError } from "../cli/usage-error.ts";
import { parseVerifyArgs } from "./args.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const ALL = [
  "--report",
  "r.json",
  "--bundle",
  "r.sigstore.json",
  "--repository",
  "acme/shop",
  "--workflow",
  ".github/workflows/rollback-gate.yml",
  "--ref",
  "refs/heads/main",
  "--sha",
  SHA,
];

describe("parseVerifyArgs", () => {
  it("reads every flag; fail-on defaults to unsafe", () => {
    expect(parseVerifyArgs(ALL)).toEqual({
      kind: "run",
      options: {
        report: "r.json",
        bundle: "r.sigstore.json",
        signer: {
          identity:
            "https://github.com/acme/shop/.github/workflows/rollback-gate.yml@refs/heads/main",
          repository: "acme/shop",
          ref: "refs/heads/main",
        },
        sha: SHA,
        failOn: "unsafe",
      },
    });
  });

  it("takes --fail-on risky", () => {
    const parsed = parseVerifyArgs([...ALL, "--fail-on", "risky"]);
    expect(parsed.kind === "run" && parsed.options.failOn).toBe("risky");
  });

  it("asks for help", () => {
    expect(parseVerifyArgs(["--help"])).toEqual({ kind: "help" });
  });

  it.each(["--report", "--bundle", "--repository", "--workflow", "--ref", "--sha"])(
    "requires %s: no check can be left out",
    (flag) => {
      const i = ALL.indexOf(flag);
      const without = [...ALL.slice(0, i), ...ALL.slice(i + 2)];
      expect(() => parseVerifyArgs(without)).toThrow(UsageError);
      expect(() => parseVerifyArgs(without)).toThrow(new RegExp(`${flag} is required`));
    },
  );

  it.each([
    ["a short SHA", "0123456"],
    ["an uppercase SHA", SHA.toUpperCase()],
    ["a ref name", "main"],
  ])("rejects %s for --sha", (_, sha) => {
    const argv = [...ALL];
    argv[argv.indexOf("--sha") + 1] = sha;
    expect(() => parseVerifyArgs(argv)).toThrow(/--sha must be a full 40-character commit SHA/);
  });

  it.each([
    [["--fail-on", "never"], /--fail-on/],
    [["--certificate-identity-regexp", ".*"], /certificate-identity-regexp/],
    [["extra"], /extra/],
  ])("rejects %j", (extra, message) => {
    expect(() => parseVerifyArgs([...ALL, ...extra])).toThrow(message);
  });
});
