#!/usr/bin/env bash
# The action's signing step: signs the JSON report with cosign, keyless, on push events only, and records the bundle path.
set -euo pipefail

bundle=""
if [[ "$EVENT" != "push" ]]; then
  # Pull request code is untrusted, and fork pull requests get no OIDC token anyway.
  echo "::notice title=Rigseal::Not signing on '$EVENT' events: only reports for pushed code are signed."
elif [[ -z "$REPORT_JSON" || ! -f "$REPORT_JSON" ]]; then
  echo "::notice title=Rigseal::No report to sign: the gate itself failed."
elif [[ -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]]; then
  # Asked to sign but can't: fail loudly, a deploy may depend on this signature.
  echo "::error title=Rigseal::Signing needs an OIDC token: add 'id-token: write' to the job's permissions."
  exit 1
else
  bundle="${REPORT_JSON%.json}.sigstore.json"
  # Keyless: a short-lived certificate for this workflow's identity, logged in Sigstore's public
  # transparency log. The bundle holds the signature, the certificate and the log entry.
  cosign sign-blob --yes --bundle "$bundle" "$REPORT_JSON"
  echo "Signed $REPORT_JSON → $bundle"
fi

echo "bundle=$bundle" >> "$GITHUB_OUTPUT"
