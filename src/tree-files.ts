// Test support: reads every file under a folder of this project into `{ "relative/path": text }`, for test repos.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** `dir` is a folder URL (ending in "/"); paths in the result are relative to it, with "/". */
export function treeFiles(dir: URL, prefix = ""): Record<string, string> {
  const root = fileURLToPath(dir);
  const files: Record<string, string> = {};
  for (const path of readdirSync(root, { recursive: true, encoding: "utf8" }).sort()) {
    const full = join(root, path);
    if (statSync(full).isFile()) files[`${prefix}${path}`] = readFileSync(full, "utf8");
  }
  return files;
}
