#!/usr/bin/env node
// The `rigseal` executable: runs the gate (or `verify` before a deploy) in the current directory and sets the exit code.
import { writeFile } from "node:fs/promises";
import { run } from "./cli/run.ts";
import { runVerify } from "./verify/run-verify.ts";

const argv = process.argv.slice(2);
const stdout = (text: string) => process.stdout.write(text);
const stderr = (text: string) => process.stderr.write(text);

// exitCode, not process.exit(): stdout is flushed before Node exits, even when piped.
process.exitCode =
  argv[0] === "verify"
    ? await runVerify(argv.slice(1), { cosign: "cosign", gh: "gh", stdout, stderr })
    : await run(argv, {
        repo: process.cwd(),
        stdout,
        stderr,
        writeFile: (path, text) => writeFile(path, text, "utf8"),
      });
