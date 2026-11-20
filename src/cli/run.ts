// One run of the gate, wired end to end: arguments → git → pure core → report files and stdout → exit code.
import { analyze } from "../analyze.ts";
import { exitCode } from "../exit-code.ts";
import { GitError } from "../git/errors.ts";
import { resolveCommit } from "../git/resolve-commit.ts";
import { readSnapshot } from "../git/snapshot.ts";
import { buildReport } from "../report/build-report.ts";
import { renderJson } from "../report/json.ts";
import { renderMarkdown } from "../report/markdown.ts";
import { renderText } from "../report/text.ts";
import { toolVersion } from "../tool-version.ts";
import { parseCliArgs } from "./args.ts";
import { chooseBase } from "./choose-base.ts";
import { failureMessage } from "./failure-message.ts";
import { OutputError } from "./output-error.ts";
import { USAGE } from "./usage.ts";

/** Everything the run touches outside itself, passed in so tests can run it in-process. */
export interface RunIo {
  /** The git repository to read: the CLI passes the current directory. */
  readonly repo: string;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  /** Writes a report file; a relative path is relative to where the CLI was started. */
  readonly writeFile: (path: string, text: string) => Promise<void>;
}

/**
 * Exit 2 means the tool itself failed and prints only one stderr line, never a verdict.
 * Unparsable SQL is not a failure: the core turns it into an RG-DB-021 finding, so it exits 1.
 */
export async function run(argv: readonly string[], io: RunIo): Promise<0 | 1 | 2> {
  try {
    const parsed = parseCliArgs(argv);
    if (parsed.kind === "help") {
      io.stdout(USAGE);
      return 0;
    }
    const { options } = parsed;
    const paths = { schema: options.schema, migrations: options.migrations };

    const base = await chooseBase(io.repo, options.base);
    const head = { ref: options.head, sha: await resolveCommit(io.repo, options.head) };
    const baseSnapshot = await side(`base ${base.ref}`, readSnapshot(io.repo, base.sha, paths));
    const headSnapshot = await side(`head ${head.ref}`, readSnapshot(io.repo, head.sha, paths));

    const report = buildReport({
      version: toolVersion(),
      base,
      head,
      migrationsDir: options.migrations,
      analysis: await analyze(baseSnapshot, headSnapshot),
    });

    // Files before stdout: if one can't be written, the run is a failure and prints no verdict.
    if (options.json !== undefined) await write(io, "JSON", options.json, renderJson(report));
    if (options.markdown !== undefined) {
      await write(io, "Markdown", options.markdown, renderMarkdown(report));
    }
    io.stdout(renderText(report));
    return exitCode(report.verdict, options.failOn);
  } catch (err) {
    io.stderr(`${failureMessage(err)}\n`);
    return 2;
  }
}

/** Snapshots are read by SHA; prefix git's message with the side and ref the user knows. */
async function side<T>(label: string, read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (err) {
    if (err instanceof GitError) {
      throw new GitError(err.code, `${label}: ${err.message}`, { cause: err });
    }
    throw err;
  }
}

async function write(io: RunIo, format: string, path: string, text: string): Promise<void> {
  try {
    await io.writeFile(path, text);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new OutputError(`can't write the ${format} report to ${path}: ${why}`, { cause: err });
  }
}
