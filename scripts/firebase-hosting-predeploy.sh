#!/usr/bin/env bash
# firebase-hosting-predeploy — force a fresh dist before every local hosting
# deploy. Skips the rebuild when node_modules is absent so the CI flow
# (Job 2 of deploy-production.yml downloads a pre-built dist artifact
# without source) continues to work.
#
# Rationale: devs kept shipping stale chunks after merging other branches
# because `firebase deploy --only hosting` uploads whatever is in dist/.
# Wiring this through firebase.json `hosting.predeploy` makes that
# mistake impossible for local deploys.
set -euo pipefail

# All status output goes to stderr so callers that capture stdout for JSON
# (e.g. `firebase hosting:channel:deploy --json > deploy-output.json` in
# the Deploy Preview CI job) get a clean stream. Mixing this echo into
# stdout used to put the predeploy notice before the JSON object and
# jq failed with "Invalid literal at line 1, column 10".
if [ ! -d node_modules ]; then
  echo "[firebase predeploy] node_modules not present -- skipping rebuild (CI flow with pre-built artifact)" >&2
  exit 0
fi

echo "[firebase predeploy] rebuilding dist from source..." >&2
rm -rf dist
npm run build >&2
