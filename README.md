# Rollback Gate

**Can the last release's code still run on the database this pull request's migrations leave?**

When a release goes wrong, you redeploy the previous version of the app. Nobody rolls the database
back: Prisma migrations only go forward. So after a rollback, the **previous release's code runs
against the database as the new release's migrations left it**. If the new release dropped a column,
renamed a table or added a required column, the "safe" rollback breaks production too.

Rollback Gate checks this on every pull request, before the merge. It reads the last release's
Prisma schema and the pull request's new migrations from git, judges every change, and answers
`SAFE`, `RISKY` or `UNSAFE`, with a reason and a fix for each finding.

Scope: **Prisma 7.10.1 + PostgreSQL**, one release back, database changes only.

## Why it exists

A one-line rename in `schema.prisma` makes Prisma generate `DROP COLUMN` + `ADD COLUMN`. Shipped and
then rolled back, the previous release fails on **every query of that model**: Prisma's client
selects every scalar column by default, so the missing column breaks reads that never used the
field (`P2022`). Prisma itself gives no warning: after the rollback, `prisma migrate status` reports
"Database schema is up to date!". A check that runs before the merge is the only warning there is.

## What the PR comment looks like

<!-- Screenshot from the demo repo goes here (T7.2). -->

```text
## Rollback Gate: 🔴 UNSAFE

Base `v1` (`b4dc701`, tag) → head `HEAD` (`b099615`)
3 UNSAFE · 0 RISKY · 2 SAFE notes

### 🔴 UNSAFE · RG-DB-002 · `User.name`
`prisma/migrations/20261116130000_fullname_phone/migration.sql:8`
Base uses column "User"."name": by default base's Prisma client selects every scalar column
of a model, so every query on the model fails, not only the ones that use this field.
Fix: Retire the field first (`@ignore` it and stop writing it; make it nullable if it is
required), then drop it one release later.

### 🔴 UNSAFE · RG-DB-005 · `User.fullName`
…
▸ 2 SAFE notes (folded)
```

## Use it in GitHub Actions

```yaml
# .github/workflows/rollback-gate.yml
name: Rollback Gate
on:
  pull_request: # never the _target variant: PR code must not run with a write token
permissions:
  contents: read
  pull-requests: write # for the sticky comment
jobs:
  gate:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0 # tags and history: base is found from release tags
          persist-credentials: false
      - uses: HarounMehdaoui/rigseal@v0.1.0
```

For supply-chain safety, pin both actions to a full commit SHA instead of a tag.

The action builds the tool at the tag you use, runs it, writes the report to the job summary, keeps
**one** comment on the pull request (edited on every push), and sets the check from the verdict.
Pull requests from forks get the job summary only, because their token is read-only.

| Input          | Default                | Meaning                                             |
| -------------- | ---------------------- | --------------------------------------------------- |
| `target`       | the PR's base branch   | branch whose newest release tag is base             |
| `tag-pattern`  | `v*`                   | which tags are releases                             |
| `schema`       | `prisma/schema.prisma` | the schema file, repo-relative                      |
| `migrations`   | `prisma/migrations`    | the migrations folder, repo-relative                |
| `fail-on`      | `unsafe`               | `risky` also fails the check on RISKY               |
| `comment`      | `true`                 | keep the sticky PR comment                          |
| `github-token` | `github.token`         | token for the comment; needs `pull-requests: write` |

Outputs: `verdict` (`SAFE`/`RISKY`/`UNSAFE`, empty if the tool failed) and `exit-code`.

## Use it from the command line

Requires Node 26 and git.

```sh
git clone https://github.com/HarounMehdaoui/rigseal.git
cd rigseal
npm ci
npm run build
cd /path/to/your/prisma/project
node /path/to/rigseal/dist/cli.js --help
node /path/to/rigseal/dist/cli.js --json report.json --markdown report.md
```

It reads committed files from git objects only, never your working tree, so commit first.

```text
Choosing base (the release a rollback goes back to):
  --target <branch>       branch whose latest release tag is base (default: main)
  --tag-pattern <glob>    release tags to look for (default: v*)
  --base <ref>            use this ref as base instead; not with --target or --tag-pattern
Head and paths:
  --head <ref>            the code under review (default: HEAD)
  --schema <path>         schema file, repo-relative (default: prisma/schema.prisma)
  --migrations <path>     migrations folder, repo-relative (default: prisma/migrations)
Reports (the text report always goes to stdout):
  --json <file>           also write the JSON report
  --markdown <file>       also write the Markdown report
Exit code:
  --fail-on <level>       "unsafe" (default) or "risky"
```

| Exit code | Meaning                                                                          |
| --------- | -------------------------------------------------------------------------------- |
| `0`       | SAFE or RISKY (RISKY → `1` with `--fail-on risky`)                               |
| `1`       | UNSAFE, including a migration Postgres can't parse                               |
| `2`       | the tool itself failed: bad arguments, git error, missing or invalid base schema |

A broken tool never looks like an unsafe change, and an unsafe change never looks like a broken tool.

## How it decides

- **Base** is the release production runs: the highest-version tag matching `v*` reachable from the
  target branch. With no such tag, the target branch itself, with a warning in the report.
- **What base uses** comes from base's `schema.prisma`, read with Prisma's own parser: the tables,
  columns (by database name, after `@map`/`@@map`) and enums its client touches. `@ignore`d fields
  and columns added in this release can change freely.
- **What head changes** comes from head's **new** migrations, parsed with Postgres's own grammar
  (`libpg-query`) into typed changes. Released migrations are never re-parsed; editing or deleting
  one is a finding of its own.
- **Every change gets exactly one entry**: a finding (RISKY or UNSAFE) or a SAFE note saying why it's
  harmless. The worst entry is the verdict.
- **When unsure, it fails closed**: SQL that won't parse is UNSAFE, SQL it doesn't model is RISKY,
  a type change it can't classify is UNSAFE. It never answers SAFE by guessing.

| Rule      | Change                                                                                  | Verdict when base uses it      |
| --------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| RG-DB-001 | drop table                                                                              | UNSAFE                         |
| RG-DB-002 | drop column                                                                             | UNSAFE                         |
| RG-DB-003 | rename table                                                                            | UNSAFE                         |
| RG-DB-004 | rename column                                                                           | UNSAFE                         |
| RG-DB-005 | column that ends NOT NULL with no database default (judged at the end of the release)   | UNSAFE                         |
| RG-DB-006 | type narrowing                                                                          | RISKY                          |
| RG-DB-007 | type widening that base's Prisma scalar can't hold (e.g. `int` → `bigint` for an `Int`) | RISKY                          |
| RG-DB-008 | type change it can't classify, or one with `USING`                                      | UNSAFE                         |
| RG-DB-009 | SET NOT NULL on a field base leaves optional                                            | RISKY                          |
| RG-DB-010 | DROP NOT NULL on a field base has as required                                           | RISKY                          |
| RG-DB-011 | drop a default the database applies for base (`autoincrement()`, `dbgenerated()`)       | UNSAFE if NOT NULL, else RISKY |
| RG-DB-012 | new unique constraint, unique index or primary key                                      | RISKY                          |
| RG-DB-013 | new CHECK constraint                                                                    | RISKY                          |
| RG-DB-014 | new foreign key                                                                         | RISKY                          |
| RG-DB-015 | enum value added (base can't read it: `P2023`)                                          | RISKY                          |
| RG-DB-016 | enum value removed (recognized from Prisma's enum-recreate sequence)                    | RISKY                          |
| RG-DB-017 | enum type renamed                                                                       | UNSAFE                         |
| RG-DB-018 | UPDATE that sets a column base uses (a backfill of a new column is SAFE)                | RISKY                          |
| RG-DB-019 | DELETE or TRUNCATE                                                                      | RISKY                          |
| RG-DB-020 | a released migration edited or deleted                                                  | RISKY                          |
| RG-DB-021 | a migration Postgres can't parse                                                        | UNSAFE                         |
| RG-DB-022 | a statement that parses but isn't modelled                                              | RISKY                          |
| RG-DB-000 | anything else recognized (create table/index, drop index/constraint, …)                 | SAFE note                      |

**The safe way to rename** takes four releases (expand, switch, retire, contract), and the gate
says SAFE, RISKY, SAFE, SAFE across them. The RISKY step is the switch: the old column becomes
nullable while the previous release still treats it as required (RG-DB-010), and a catch-up UPDATE
writes the new column, which the previous release already uses (RG-DB-018). This exact sequence is
an acceptance test.

## The JSON report

`--json` writes a report meant to be signed later: `schemaVersion: 1`, tool version, base and head
SHAs, how base was chosen (`tag`, `fallback` or `explicit`), warnings, every migration with its
SHA-256, the verdict, and every entry with its repo-relative file and line. Keys are in a fixed
order, there is no timestamp, and the same inputs give byte-identical files (tested by running the
CLI twice).

## Architecture

```text
  EDGE (I/O)                PURE CORE (plain data in, plain data out)                 EDGE (I/O)
  git: base tag, files ─►  base schema ─► used set ──────────────┐
                           migrations ──► history (SHA-256 diff) ─┼─► rules ─► entries ─► verdict ─► report ─► stdout, files,
                           new SQL ─────► parse ─► normalize ─────┘                                            exit code
```

- `src/git/` is the only code that runs git (`execFile`, argument arrays, no shell).
- `src/schema/` turns base's schema into the used set with Prisma's `getDMMF`.
- `src/sql/parse.ts` is the only importer of `libpg-query`; `src/sql/normalize/` turns statements
  into typed changes, one per action.
- `src/rules/` has one file per rule and does no I/O.
- `src/report/` renders text, Markdown and JSON from one report object.
- `src/cli.ts` and `action.yml` are the shells around it.

Tests run at three layers: unit tests next to the code, scenario folders (`scenarios/<name>/` with
base, head and the expected entries, no git), and end-to-end tests that run the built CLI on
throwaway git repos with tags (`npm run test:e2e`).

## Limitations

- **Prisma 7.10.1 and PostgreSQL only**, the `public` schema only, one release back.
- **"Used" is schema-level.** Every field in base's schema counts as used, because Prisma's client
  reads them all by default. The tool doesn't scan your TypeScript, so a field the code never touches
  still counts. `$queryRaw` and other raw SQL aren't seen.
- **Default paths or flags only.** It doesn't read `prisma.config.ts` (it never executes project
  code). Multi-file schemas aren't supported.
- **It doesn't judge whether a migration is safe to run** (locks, table rewrites, data that fails a
  new constraint). Use [squawk](https://github.com/sbdchd/squawk) for that.
- **Not built in v0.1:** dropping a unique index that base's `upsert` relies on (RG-DB-023) is
  reported as a SAFE note. There is no way to acknowledge a known break; a team that breaks rollback
  on purpose sees a red check.
- **RISKY passes by default.** Use `fail-on: risky` if your team wants RISKY to block.

## Roadmap

- **v0.2: signing and deploy blocking.** Sign the JSON report as an attestation on the exact artifact
  that ships, and block deploys whose attestation is missing or `UNSAFE`.
- Later, as needed: a rollback rehearsal in a throwaway Postgres (it can only raise the verdict); a
  reviewed acknowledgement file for intended breaks; reading paths from `prisma.config.ts` without
  executing it.

## Development

```sh
npm ci
npm run lint        # Biome + TypeScript
npm test            # unit + scenario tests
npm run test:e2e    # builds dist/, then runs the CLI on throwaway git repos
```

## License

[MIT](LICENSE)
