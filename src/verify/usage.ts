// The `verify --help` text: every flag, all required except --fail-on, and what the exit codes mean.

export const VERIFY_USAGE = `Usage: rigseal verify [options]

Before a deploy: checks that a Rigseal report was signed by your workflow, at the commit you
are deploying, is about that commit, and has a verdict your policy allows. Needs cosign on PATH.

Every check always runs; none can be switched off.

The report and its bundle, from exactly one source:
  --report <file>         the JSON report            (local files: give both)
  --bundle <file>         its cosign bundle
  --from-github           or fetch them: the newest completed push run of --workflow on --ref at
                          --sha in --repository, any conclusion. Needs gh, logged in or GH_TOKEN
                          with actions:read. What is fetched is untrusted until verified.
  --artifact <name>       the artifact name with --from-github (default: rigseal-report)

The signer (all required, matched exactly, never as a pattern):
  --repository <o/r>      the repository whose workflow signed, e.g. acme/shop
  --workflow <path>       the signing workflow file, e.g. .github/workflows/rigseal.yml
  --ref <ref>             the ref it ran on, e.g. refs/heads/main

The deploy:
  --sha <sha>             the full commit SHA being deployed (required)
  --fail-on <level>       "unsafe" (default) or "risky": the lowest verdict that refuses the deploy
  -h, --help              show this text

  0  deploy allowed   1  deploy refused   2  the tool itself failed (bad arguments, cosign or gh failing)
`;
