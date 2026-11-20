import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeCosign, makeFakeCosign } from "../sigstore/fake-cosign.ts";
import { runVerify } from "./run-verify.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const SIGNER = [
  "--repository",
  "acme/shop",
  "--workflow",
  ".github/workflows/rollback-gate.yml",
  "--ref",
  "refs/heads/main",
];

let dir: string;
let cosign: FakeCosign;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "rg-verify-"));
  cosign = await makeFakeCosign();
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await cosign.remove();
});

async function files(verdict = "SAFE", sha = SHA): Promise<string[]> {
  const report = join(dir, "report.json");
  const bundle = join(dir, "report.sigstore.json");
  await writeFile(
    report,
    JSON.stringify({ schemaVersion: 1, tool: { name: "rollback-gate" }, verdict, head: { sha } }),
  );
  await writeFile(bundle, "{}");
  return ["--report", report, "--bundle", bundle];
}

async function verify(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const code = await runVerify(argv, {
    cosign: cosign.path,
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
        `rollback-gate verify: OK: SAFE report for ${SHA}, signed by ` +
        "https://github.com/acme/shop/.github/workflows/rollback-gate.yml@refs/heads/main\n",
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
      "rollback-gate verify: refused: the signature doesn't verify: Error: invalid signature when validating ASN.1 encoded signature\n",
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
      stdout: () => {},
      stderr: (text) => {
        stderr += text;
      },
    });
    expect(code).toBe(2);
    expect(stderr).toMatch(/^rollback-gate: could not run cosign/);
  });

  it("prints its own help", async () => {
    const result = await verify("--help");
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^Usage: rollback-gate verify/);
  });
});
