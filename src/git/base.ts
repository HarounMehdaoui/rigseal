// Picks "base": the release production runs, i.e. the code a rollback goes back to (D5, D35).
import { resolveCommit, runGit } from "./git.ts";

export type BaseResolution =
  | { readonly ref: string; readonly sha: string; readonly method: "tag" }
  | {
      readonly ref: string;
      readonly sha: string;
      readonly method: "fallback";
      readonly warning: string;
    };

/**
 * The highest-version tag matching `pattern` that is reachable from `target`.
 * With no such tag, `target` itself, plus a warning for the report.
 */
export async function resolveBase(
  repo: string,
  target: string,
  pattern: string,
): Promise<BaseResolution> {
  const targetSha = await resolveCommit(repo, target);

  const tags = await runGit(repo, [
    // Sort "v2.0.0-rc.1" below "v2.0.0"; git's default puts the prerelease above (D35).
    "-c",
    "versionsort.suffix=-",
    "tag",
    "--list",
    "--merged",
    targetSha,
    "--sort=-v:refname",
    "--",
    pattern,
  ]);
  const latest = tags.split("\n").find((line) => line !== "");

  if (latest === undefined) {
    return {
      ref: target,
      sha: targetSha,
      method: "fallback",
      warning:
        `No tag matching "${pattern}" is reachable from "${target}", so base is "${target}" itself: ` +
        "changes already merged there count as released even if they never shipped.",
    };
  }
  // refs/tags/ so a branch with the same name can't be picked by mistake.
  return { ref: latest, sha: await resolveCommit(repo, `refs/tags/${latest}`), method: "tag" };
}
