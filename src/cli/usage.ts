// The `--help` text: every flag, its default, and what the exit codes mean.

export const USAGE = `Usage: rollback-gate [options]

Can the last release's code still run on the database that head's Prisma migrations leave?
Reads committed files only (git objects), never the working tree.

Choosing base (the release a rollback goes back to):
  --target <branch>       branch whose latest release tag is base (default: main)
  --tag-pattern <glob>    release tags to look for (default: v*)
  --base <ref>            use this ref as base instead; not with --target or --tag-pattern

Head and paths:
  --head <ref>            the code under review (default: HEAD)
  --schema <path>         schema file, repo-relative (default: prisma/schema.prisma)
  --migrations <path>     migrations folder, repo-relative (default: prisma/migrations)

Reports (the text report always goes to stdout):
  --json <file>           also write the JSON report (schemaVersion 1, byte-identical across runs)
  --markdown <file>       also write the Markdown report (for a PR comment or job summary)

Exit code:
  --fail-on <level>       "unsafe" (default) or "risky": the lowest verdict that exits 1
  -h, --help              show this text

  0  SAFE or RISKY   1  UNSAFE (or RISKY with --fail-on risky)   2  the tool itself failed
`;
