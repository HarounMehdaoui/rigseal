import { describe, expect, it } from "vitest";
import { UsageError } from "../cli/usage-error.ts";
import { parseVerifyArgs } from "./args.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const FILES = ["--report", "r.json", "--bundle", "r.sigstore.json"];
const SIGNER = [
  "--repository",
  "acme/shop",
  "--workflow",
  ".github/workflows/rollback-gate.yml",
  "--ref",
  "refs/heads/main",
  "--sha",
  SHA,
];
const ALL = [...FILES, ...SIGNER];
const EXPECTED_SIGNER = {
  identity: "https://github.com/acme/shop/.github/workflows/rollback-gate.yml@refs/heads/main",
  repository: "acme/shop",
  ref: "refs/heads/main",
};

describe("parseVerifyArgs", () => {
  it("reads local files; fail-on defaults to unsafe", () => {
    expect(parseVerifyArgs(ALL)).toEqual({
      kind: "run",
      options: {
        source: { kind: "files", report: "r.json", bundle: "r.sigstore.json" },
        workflow: ".github/workflows/rollback-gate.yml",
        signer: EXPECTED_SIGNER,
        sha: SHA,
        failOn: "unsafe",
      },
    });
  });

  it("fetches from GitHub with --from-github, artifact name defaulting to the action's", () => {
    expect(parseVerifyArgs(["--from-github", ...SIGNER])).toEqual({
      kind: "run",
      options: {
        source: { kind: "github", artifact: "rollback-gate-report" },
        workflow: ".github/workflows/rollback-gate.yml",
        signer: EXPECTED_SIGNER,
        sha: SHA,
        failOn: "unsafe",
      },
    });
    const named = parseVerifyArgs(["--from-github", "--artifact", "gate", ...SIGNER]);
    expect(named.kind === "run" && named.options.source).toEqual({
      kind: "github",
      artifact: "gate",
    });
  });

  it("takes --fail-on risky", () => {
    const parsed = parseVerifyArgs([...ALL, "--fail-on", "risky"]);
    expect(parsed.kind === "run" && parsed.options.failOn).toBe("risky");
  });

  it("asks for help", () => {
    expect(parseVerifyArgs(["--help"])).toEqual({ kind: "help" });
  });

  it.each([
    [[...SIGNER], /either --report and --bundle, or --from-github/],
    [["--report", "r.json", ...SIGNER], /either --report and --bundle, or --from-github/],
    [["--bundle", "b.json", ...SIGNER], /either --report and --bundle, or --from-github/],
    [["--from-github", ...FILES, ...SIGNER], /either --report and --bundle, or --from-github/],
    [["--artifact", "gate", ...ALL], /--artifact only goes with --from-github/],
  ])("needs exactly one source: rejects %j", (argv, message) => {
    expect(() => parseVerifyArgs(argv)).toThrow(UsageError);
    expect(() => parseVerifyArgs(argv)).toThrow(message);
  });

  it.each(["--repository", "--workflow", "--ref", "--sha"])(
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
    [["--artifact", ""], /--artifact/],
  ])("rejects %j", (extra, message) => {
    expect(() => parseVerifyArgs([...ALL, ...extra])).toThrow(message);
  });
});
