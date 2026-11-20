#!/usr/bin/env node
// The `rollback-gate` executable: runs the gate on the current directory's repository and sets the exit code.
import { writeFile } from "node:fs/promises";
import { run } from "./cli/run.ts";

// exitCode, not process.exit(): stdout is flushed before Node exits, even when piped.
process.exitCode = await run(process.argv.slice(2), {
  repo: process.cwd(),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  writeFile: (path, text) => writeFile(path, text, "utf8"),
});
