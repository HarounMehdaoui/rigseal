#!/usr/bin/env bash
# Keeps one Rollback Gate comment on the PR: finds the bot's comment by its hidden marker and edits it, or creates one.
set -euo pipefail

# GitHub refuses comments over 65,536 characters; stay well under and point to the job summary.
max_bytes=60000
body="$RUNNER_TEMP/rollback-gate/comment.md"
if (( $(wc -c < "$REPORT") > max_bytes )); then
  head -c "$max_bytes" "$REPORT" > "$body"
  printf '\n\n… report cut to fit a comment: the job summary has all of it.\n' >> "$body"
else
  cp "$REPORT" "$body"
fi

# Only a bot's comment counts: a PR author can't plant the marker and have their comment taken over.
id="$(gh api --paginate "repos/$REPO/issues/$PR_NUMBER/comments" \
  --jq '.[] | select(.user.type == "Bot" and (.body | startswith("<!-- rollback-gate -->"))) | .id' |
  tail -n 1)"

if [[ -n "$id" ]]; then
  gh api --method PATCH "repos/$REPO/issues/comments/$id" -F "body=@$body" > /dev/null
  echo "Updated the Rollback Gate comment ($id)."
else
  gh api --method POST "repos/$REPO/issues/$PR_NUMBER/comments" -F "body=@$body" > /dev/null
  echo "Posted the Rollback Gate comment."
fi
