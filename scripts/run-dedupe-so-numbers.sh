#!/usr/bin/env bash
# Run SO number deduplication with Google Cloud / ADC.
#
# Prerequisites:
#   gcloud (https://cloud.google.com/sdk)
#
# 1) Point gcloud at the right project (or export GOOGLE_CLOUD_PROJECT):
#    gcloud config set project dawinos
#
# 2) Application Default Credentials (used by Firebase Admin in Node):
#    gcloud auth application-default login
#
# Then:
#   ./scripts/run-dedupe-so-numbers.sh            # dry-run
#   ./scripts/run-dedupe-so-numbers.sh --apply  # write
#
# Extra args are forwarded, e.g.:
#   ./scripts/run-dedupe-so-numbers.sh --apply --force-qbo

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gcloud &>/dev/null; then
  echo "Error: gcloud CLI not found. Install: https://cloud.google.com/sdk" >&2
  exit 1
fi

# Prefer explicit env, else active gcloud project
if [[ -z "${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-${FIREBASE_PROJECT_ID:-}}}" ]]; then
  GCLOUD_PROJ=$(gcloud config get-value project 2>/dev/null | tr -d '\n' || true)
  if [[ -n "$GCLOUD_PROJ" && "$GCLOUD_PROJ" != "(unset)" ]]; then
    export GOOGLE_CLOUD_PROJECT="$GCLOUD_PROJ"
    echo "Using gcloud project: $GOOGLE_CLOUD_PROJECT"
  else
    echo "Warning: No GOOGLE_CLOUD_PROJECT and no default gcloud project. Set: gcloud config set project <id> or export GOOGLE_CLOUD_PROJECT=..." >&2
  fi
else
  echo "Using project: ${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-${FIREBASE_PROJECT_ID}}}"
  export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-${GCLOUD_PROJECT:-${FIREBASE_PROJECT_ID}}}"
fi

# Quick check: ADC is usable (fails with clear message if not logged in)
if ! gcloud auth application-default print-access-token &>/dev/null; then
  echo "Error: No valid application-default credentials. Run:" >&2
  echo "  gcloud auth application-default login" >&2
  exit 1
fi

exec node "$ROOT/scripts/dedupe-sales-order-numbers.cjs" "$@"
