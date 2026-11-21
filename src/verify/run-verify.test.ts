import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeGh, makeFakeGh } from "../github/fake-gh.ts";
import { type FakeCosign, makeFakeCosign } from "../sigstore/fake-cosign.ts";
import { runVerify } from "./run-verify.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const SIGNER = [
  "--repository",
  "acme/shop",
  "--workflow",
  ".github/workflows/rigseal.yml",
  "--ref",
  "refs/heads/main",
];

let dir: string;
let cosign: FakeCosign;
let gh: FakeGh;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rg-verify-"));
  cosign = await makeFakeCosign();
  gh = await makeFakeGh();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await cosign.remove();
  await gh.remove();
});

async function files(verdict = "SAFE", sha = SHA): Promise<string[]> {
  const report = join(dir, "report.json");
  const bundle = join(dir, "report.sigstore.json");
  await writeFile(
    report,
    JSON.stringify({ schemaVersion: 1, tool: { name: "rigseal" }, verdict, head: { sha } }),
  );
  await writeFile(bundle, "{}");
  return ["--report", report, "--bundle", bundle];
}

async function verify(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await runVerify(argv, {
    cosign: cosign.path,
    gh: gh.path,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });
  return { code, stdout, stderr };
}

describe("runVerify", () => {
  it("allows a signed SAFE report about the deploy commit (exit 0)", async () => {
    const result = await verify(...(await files()), ...SIGNER, "--sha", SHA);
    expect(result).toEqual({
      code: 0,
      stdout:
        `rigseal verify: OK: SAFE report for ${SHA}, signed by ` +
        "https://github.com/acme/shop/.github/workflows/rigseal.yml@refs/heads/main\n",
      stderr: "",
    });
  });

  it("verifies a private copy of the report, so the file can't change between check and use", async () => {
    const argv = await files();
    await verify(...argv, ...SIGNER, "--sha", SHA);
    const blob = (await cosign.lastArgs()).at(-1);
    expect(blob).not.toBe(argv[1]);
    expect(blob).toMatch(/report\.json$/);
  });

  it("refuses when the signature doesn't verify (exit 1), quoting cosign", async () => {
    await cosign.behave(1, "Error: invalid signature when validating ASN.1 encoded signature");
    const result = await verify(...(await files()), ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      "rigseal verify: refused: the signature doesn't verify: Error: invalid signature when validating ASN.1 encoded signature\n",
    );
  });

  it("refuses UNSAFE, and RISKY with --fail-on risky", async () => {
    expect((await verify(...(await files("UNSAFE")), ...SIGNER, "--sha", SHA)).code).toBe(1);
    expect((await verify(...(await files("RISKY")), ...SIGNER, "--sha", SHA)).code).toBe(0);
    const risky = await verify(
      ...(await files("RISKY")),
      ...SIGNER,
      "--sha",
      SHA,
      "--fail-on",
      "risky",
    );
    expect(risky.code).toBe(1);
    expect(risky.stderr).toMatch(/refused: .*verdict is RISKY/);
  });

  it("refuses a report about another commit", async () => {
    const result = await verify(...(await files("SAFE", "f".repeat(40))), ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/not the deploy commit/);
  });

  it.each(["report", "bundle"])(
    "refuses a missing %s file without calling cosign",
    async (which) => {
      const argv = await files();
      const i = argv.indexOf(`--${which}`) + 1;
      argv[i] = join(dir, "missing.json");
      await cosign.behave(0);
      const result = await verify(...argv, ...SIGNER, "--sha", SHA);
      expect(result.code).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`refused: can't read the ${which} file`));
    },
  );

  it("exits 2 on bad arguments and when cosign can't run", async () => {
    expect((await verify("--sha", SHA)).code).toBe(2);
    const argv = [...(await files()), ...SIGNER, "--sha", SHA];
    let stderr = "";
    const code = await runVerify(argv, {
      cosign: "/nonexistent/cosign",
      gh: gh.path,
      stdout: () => {},
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code).toBe(2);
    expect(stderr).toMatch(/^rigseal: could not run cosign/);
  });

  it("prints its own help", async () => {
    const result = await verify("--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: rigseal verify/);
  });
});

describe("runVerify --from-github", () => {
  /** gh behaviour: `run list` finds run 42 at SHA; `run download` writes the given verdict's report. */
  async function github(
    verdict: string,
    run = `[{"databaseId":42,"conclusion":"success","headSha":"${SHA}"}]`,
  ) {
    const report = JSON.stringify({
      schemaVersion: 1,
      tool: { name: "rigseal" },
      verdict,
      head: { sha: SHA },
    });
    await gh.behave(`case "$2" in
  list) echo '${run}' ;;
  download) d=""; while [ $# -gt 0 ]; do [ "$1" = "--dir" ] && d="$2"; shift; done
    echo '${report}' > "$d/report.json"; echo '{}' > "$d/report.sigstore.json" ;;
esac`);
  }

  it("fetches the gate run's artifact for the deploy commit and verifies it", async () => {
    await github("SAFE");
    const result = await verify("--from-github", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(new RegExp(`OK: SAFE report for ${SHA} \\(run 42\\), signed by`));
    const [list, download] = await gh.calls();
    expect(list?.slice(0, 2)).toEqual(["run", "list"]);
    expect(download?.slice(0, 7)).toEqual([
      "run",
      "download",
      "42",
      "--repo",
      "acme/shop",
      "--name",
      "rigseal-report",
    ]);
  });

  it("refuses an UNSAFE commit for its real reason, though its gate run failed", async () => {
    await github("UNSAFE", `[{"databaseId":42,"conclusion":"failure","headSha":"${SHA}"}]`);
    const result = await verify("--from-github", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/refused: the verdict is UNSAFE/);
  });

  it("refuses when no gate run exists for the commit", async () => {
    await gh.behave("echo '[]'");
    const result = await verify("--from-github", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(
      new RegExp(
        `refused: no completed push run of .github/workflows/rigseal.yml on refs/heads/main at ${SHA} in acme/shop`,
      ),
    );
  });

  it("refuses when the run's artifact is missing or expired", async () => {
    await gh.behave(`case "$2" in
  list) echo '[{"databaseId":42,"conclusion":"success","headSha":"${SHA}"}]' ;;
  download) echo 'no valid artifacts found to download' >&2; exit 1 ;;
esac`);
    const result = await verify("--from-github", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(
      /refused: can't download artifact "rigseal-report" or "rollback-gate-report" of run 42: no valid artifacts found/,
    );
  });

  it("falls back to the artifact name used before the rename", async () => {
    const report = JSON.stringify({
      schemaVersion: 1,
      tool: { name: "rollback-gate" },
      verdict: "SAFE",
      head: { sha: SHA },
    });
    await gh.behave(`case "$2" in
  list) echo '[{"databaseId":42,"conclusion":"success","headSha":"${SHA}"}]' ;;
  download) n=""; d=""; while [ $# -gt 0 ]; do [ "$1" = "--name" ] && n="$2"; [ "$1" = "--dir" ] && d="$2"; shift; done
    if [ "$n" = "rollback-gate-report" ]; then echo '${report}' > "$d/report.json"; echo '{}' > "$d/report.sigstore.json"
    else echo 'no valid artifacts found to download' >&2; exit 1; fi ;;
esac`);
    const result = await verify("--from-github", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(0);
    const names = (await gh.calls())
      .filter((c) => c[1] === "download")
      .map((c) => c[c.indexOf("--name") + 1]);
    expect(names).toEqual(["rigseal-report", "rollback-gate-report"]);
  });

  it("uses only the artifact name given with --artifact", async () => {
    await gh.behave(`case "$2" in
  list) echo '[{"databaseId":42,"conclusion":"success","headSha":"${SHA}"}]' ;;
  download) echo 'no valid artifacts found to download' >&2; exit 1 ;;
esac`);
    const result = await verify("--from-github", "--artifact", "gate", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/can't download artifact "gate" of run 42/);
  });

  it("exits 2 when gh itself fails, e.g. not logged in", async () => {
    await gh.behave("echo 'gh auth login' >&2; exit 4");
    const result = await verify("--from-github", ...SIGNER, "--sha", SHA);
    expect(result.code).toBe(2);
    expect(result.stderr).toMatch(/^rigseal: gh run list failed: gh auth login/);
  });
});
