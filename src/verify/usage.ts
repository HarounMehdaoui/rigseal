// The `verify --help` text: every flag, all required except --fail-on, and what the exit codes mean.

export const VERIFY_USAGE = `Usage: rollback-gate verify [options]

Before a deploy: checks that a Rollback Gate report was signed by your workflow, at the commit you
are deploying, is about that commit, and has a verdict your policy allows. Needs cosign on PATH.

Every check always runs; none can be switched off.

Files (both required):
  --report <file>         the JSON report
  --bundle <file>         its cosign bundle

The signer (all required, matched exactly, never as a pattern):
  --repository <o/r>      the repository whose workflow signed, e.g. acme/shop
  --workflow <path>       the signing workflow file, e.g. .github/workflows/rollback-gate.yml
  --ref <ref>             the ref it ran on, e.g. refs/heads/main

The deploy:
  --sha <sha>             the full commit SHA being deployed (required)
  --fail-on <level>       "unsafe" (default) or "risky": the lowest verdict that refuses the deploy
  -h, --help              show this text

  0  deploy allowed   1  deploy refused   2  the tool itself failed (bad arguments, cosign missing)
`;
