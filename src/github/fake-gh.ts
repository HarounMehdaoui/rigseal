// Test support: a fake `gh` executable that records each call's arguments and runs a shell body the test supplies.
import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface FakeGh {
  /** Path to pass as the gh executable. */
  readonly path: string;
  /** Every call's arguments, oldest first. */
  calls(): Promise<string[][]>;
  /** The shell body each call runs, with the call's arguments as "$@". */
  behave(body: string): Promise<void>;
  remove(): Promise<void>;
}

export async function makeFakeGh(): Promise<FakeGh> {
  const dir = await mkdtemp(join(tmpdir(), "rg-gh-"));
  const path = join(dir, "gh");
  const callsDir = join(dir, "calls");
  const behaviour = join(dir, "behaviour");
  await writeFile(join(dir, "count"), "0");

  // NUL-separated, one file per call, so arguments are recorded exactly and in order.
  await writeFile(
    path,
    `#!/bin/sh
mkdir -p '${callsDir}'
n=$(cat '${dir}/count'); n=$((n + 1)); echo "$n" > '${dir}/count'
printf '%s\\0' "$@" > '${callsDir}/'$(printf '%04d' "$n")
. '${behaviour}'
`,
  );
  await chmod(path, 0o755);

  const fake: FakeGh = {
    path,
    async calls() {
      let names: string[];
      try {
        names = (await readdir(callsDir)).sort();
      } catch {
        return [];
      }
      return Promise.all(
        names.map(async (name) =>
          (await readFile(join(callsDir, name), "utf8")).split("\0").slice(0, -1),
        ),
      );
    },
    behave: (body) => writeFile(behaviour, `${body}\n`),
    remove: () => rm(dir, { recursive: true, force: true }),
  };
  await fake.behave("exit 0");
  return fake;
}
