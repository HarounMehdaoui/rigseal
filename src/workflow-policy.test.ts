// Repo policy, not a source file: no workflow or action file may use the `_target` PR trigger.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
// Built from two parts so this file never contains the word it looks for.
const FORBIDDEN = ["pull_request", "_target"].join("");
const SCANNED = [".github", "action.yml", "action"];

function filesUnder(path: string): string[] {
  const full = join(ROOT, path);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [path];
  return readdirSync(full).flatMap((name) => filesUnder(join(path, name)));
}

describe("workflow policy", () => {
  it("scans the workflows and the action", () => {
    const files = SCANNED.flatMap(filesUnder);
    expect(files).toContain(join(".github", "workflows", "ci.yml"));
    expect(files).toContain("action.yml");
  });

  it(`never uses the ${FORBIDDEN} trigger, which runs PR code with a write token and secrets`, () => {
    const offenders = SCANNED.flatMap(filesUnder).filter((file) =>
      readFileSync(join(ROOT, file), "utf8").includes(FORBIDDEN),
    );
    expect(offenders).toEqual([]);
  });
});
