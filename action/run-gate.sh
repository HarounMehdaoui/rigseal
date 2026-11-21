#!/usr/bin/env bash
# The action's gate step: refuses a shallow clone, runs the CLI, and records exit code, verdict and report paths as step outputs.
set -euo pipefail

out="$RUNNER_TEMP/rigseal"
mkdir -p "$out"
report_md="$out/report.md"
report_json="$out/report.json"
# A job may run the action twice: never let a stale report stand in for this run's result.
rm -f "$report_md" "$report_json"

# The report shown when the tool itself failed: no verdict, and the log says why.
failure_report() {
  printf '<!-- rigseal -->\n## Rigseal: ⚠️ the gate itself failed\n\n%s\n' "$1" > "$report_md"
}

if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  message="This is a shallow clone, so release tags and history are missing. Set fetch-depth: 0 on actions/checkout."
  echo "::error title=Rigseal::$message"
  failure_report "$message"
  { echo "exit-code=2"; echo "verdict="; echo "markdown=$report_md"; echo "json="; } >> "$GITHUB_OUTPUT"
  exit 0
fi

# In a CI checkout the target branch exists only as a remote-tracking ref.
target="${GATE_TARGET:-main}"
if git rev-parse --verify --quiet "refs/remotes/origin/$target^{commit}" > /dev/null; then
  target="origin/$target"
fi

# The exit code is the result, not a script failure: keep going and let the last step set the check.
set +e
node "$GITHUB_ACTION_PATH/dist/cli.js" \
  --target "$target" \
  --tag-pattern "$GATE_TAG_PATTERN" \
  --schema "$GATE_SCHEMA" \
  --migrations "$GATE_MIGRATIONS" \
  --fail-on "$GATE_FAIL_ON" \
  --json "$report_json" \
  --markdown "$report_md"
code=$?
set -e

verdict=""
json=""
if [[ -f "$report_json" ]]; then
  verdict="$(jq -r .verdict "$report_json")"
  json="$report_json"
else
  failure_report "The tool could not run (exit $code). The job log says why."
fi

{ echo "exit-code=$code"; echo "verdict=$verdict"; echo "markdown=$report_md"; echo "json=$json"; } >> "$GITHUB_OUTPUT"
