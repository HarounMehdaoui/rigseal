import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FakeGh, makeFakeGh } from "./fake-gh.ts";
import { downloadArtifact, findGateRun } from "./gh.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const QUERY = {
  repository: "acme/shop",
  workflow: ".github/workflows/rollback-gate.yml",
  ref: "refs/heads/main",
  sha: SHA,
};

let gh: FakeGh;
let dir: string;
beforeEach(async () => {
  gh = await makeFakeGh();
  dir = await mkdtemp(join(tmpdir(), "rg-dl-"));
});
afterEach(async () => {
  await gh.remove();
  await rm(dir, { recursive: true, force: true });
});

describe("findGateRun", () => {
  it("asks for the newest completed push run of that workflow, on that branch, at that commit", async () => {
    await gh.behave(`echo '[{"databaseId":42,"conclusion":"failure","headSha":"${SHA}"}]'`);
    expect(await findGateRun(gh.path, QUERY)).toEqual({ id: 42, conclusion: "failure" });
    expect(await gh.calls()).toEqual([
      [
        "run",
        "list",
        "--repo",
        "acme/shop",
        "--workflow",
        "rollback-gate.yml",
        "--commit",
        SHA,
        "--event",
        "push",
        "--branch",
        "main",
        "--status",
        "completed",
        "--limit",
        "1",
        "--json",
        "databaseId,conclusion,headSha",
      ],
    ]);
  });

  it("uses the tag name as the branch filter for a tag ref", async () => {
    await gh.behave("echo '[]'");
    await findGateRun(gh.path, { ...QUERY, ref: "refs/tags/v1.2.0" });
    const [call] = await gh.calls();
    expect(call?.[call.indexOf("--branch") + 1]).toBe("v1.2.0");
  });

  it("returns null when there is no such run", async () => {
    await gh.behave("echo '[]'");
    expect(await findGateRun(gh.path, QUERY)).toBeNull();
  });

  it("ignores a run gh returns for another commit", async () => {
    await gh.behave(
      `echo '[{"databaseId":7,"conclusion":"success","headSha":"${"f".repeat(40)}"}]'`,
    );
    expect(await findGateRun(gh.path, QUERY)).toBeNull();
  });

  it("throws a GhError when gh fails, quoting it (e.g. not logged in)", async () => {
    await gh.behave(
      "echo 'To get started with GitHub CLI, please run:  gh auth login' >&2; exit 4",
    );
    await expect(findGateRun(gh.path, QUERY)).rejects.toMatchObject({
      name: "GhError",
      message: expect.stringMatching(/gh run list failed: To get started with GitHub CLI/),
    });
  });

  it("throws a GhError when gh can't run at all", async () => {
    await expect(findGateRun("/nonexistent/gh", QUERY)).rejects.toMatchObject({
      name: "GhError",
      message: expect.stringMatching(/could not run gh/),
    });
  });
});

describe("downloadArtifact", () => {
  it("downloads the named artifact of that run into the folder", async () => {
    await gh.behave(`d=""; while [ $# -gt 0 ]; do [ "$1" = "--dir" ] && d="$2"; shift; done
echo '{}' > "$d/report.json"`);
    expect(
      await downloadArtifact(gh.path, { repository: "acme/shop", runId: 42, name: "rg", dir }),
    ).toEqual({ ok: true });
    expect(await gh.calls()).toEqual([
      ["run", "download", "42", "--repo", "acme/shop", "--name", "rg", "--dir", dir],
    ]);
    expect(await readFile(join(dir, "report.json"), "utf8")).toBe("{}\n");
  });

  it("reports a missing or expired artifact with gh's first error line", async () => {
    await gh.behave("echo 'no valid artifacts found to download' >&2; exit 1");
    expect(
      await downloadArtifact(gh.path, { repository: "acme/shop", runId: 42, name: "rg", dir }),
    ).toEqual({ ok: false, message: "no valid artifacts found to download" });
  });
});
