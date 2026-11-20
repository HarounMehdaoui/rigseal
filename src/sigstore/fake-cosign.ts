// Test support: a fake `cosign` executable that records its arguments and exits as told, for adapter and verify tests.
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface FakeCosign {
  /** Path to pass as the cosign executable. */
  readonly path: string;
  /** The arguments of the last call, one per element. */
  lastArgs(): Promise<string[]>;
  /** What the next calls do: exit code and stderr text. */
  behave(exitCode: number, stderr?: string): Promise<void>;
  remove(): Promise<void>;
}

export async function makeFakeCosign(): Promise<FakeCosign> {
  const dir = await mkdtemp(join(tmpdir(), "rg-cosign-"));
  const path = join(dir, "cosign");
  const argsFile = join(dir, "args");
  const behaviour = join(dir, "behaviour");

  // NUL-separated, so arguments with spaces or newlines are recorded exactly.
  await writeFile(
    path,
    `#!/bin/sh
printf '%s\\0' "$@" > '${argsFile}'
. '${behaviour}'
`,
  );
  await chmod(path, 0o755);

  const fake: FakeCosign = {
    path,
    async lastArgs() {
      const text = await readFile(argsFile, "utf8");
      return text.split("\0").slice(0, -1);
    },
    async behave(exitCode, stderr = "") {
      const quoted = stderr.replaceAll("'", "'\\''");
      await writeFile(behaviour, `printf '%s\\n' '${quoted}' >&2\nexit ${exitCode}\n`);
    },
    remove: () => rm(dir, { recursive: true, force: true }),
  };
  await fake.behave(0, "Verified OK");
  return fake;
}
