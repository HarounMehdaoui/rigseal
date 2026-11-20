// Turns the base option into a commit: the explicit ref as given (D47), or the release-tag lookup (D5).
import { type BaseResolution, resolveBase } from "../git/base.ts";
import { resolveCommit } from "../git/resolve-commit.ts";
import type { BaseOption } from "./args.ts";

/** How base was chosen, as the report states it: `tag`, `fallback` (with a warning) or `explicit`. */
export type BaseChoice =
  | BaseResolution
  | { readonly ref: string; readonly sha: string; readonly method: "explicit" };

export async function chooseBase(repo: string, option: BaseOption): Promise<BaseChoice> {
  if (option.kind === "tag") return resolveBase(repo, option.target, option.pattern);
  return { ref: option.ref, sha: await resolveCommit(repo, option.ref), method: "explicit" };
}
