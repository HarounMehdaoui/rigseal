// The tool's own version for the report (D24): `version` from package.json, read once at run time.
import { readFileSync } from "node:fs";

/**
 * `../package.json` resolves from both `src/` (tests, `node src/cli.ts`) and `dist/` (the build),
 * since both sit one level below the package root. Read at run time because tsc's `rootDir: src`
 * can't import a file outside `src/`.
 */
export function toolVersion(): string {
  const pkg: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (
    typeof pkg === "object" &&
    pkg !== null &&
    "version" in pkg &&
    typeof pkg.version === "string"
  ) {
    return pkg.version;
  }
  throw new Error("package.json has no version");
}
