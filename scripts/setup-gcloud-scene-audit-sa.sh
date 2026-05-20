#!/usr/bin/env bash
# Create a least-privilege service account for local Firestore reads (Design Studio
# scene part audit) and a JSON key under .secrets/ (gitignored).
#
# Prerequisite: gcloud auth login + project set (e.g. dawinos)
# Usage: bash scripts/setup-gcloud-scene-audit-sa.sh
#
# Firebase MCP does not create service accounts; use this gcloud flow instead.
set -euo pipefail
PROJECT="${FIREBASE_PROJECT_ID:-dawinos}"
SA_ID="firestore-scene-parts-audit"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
KEY_PATH=".secrets/${SA_ID}.json"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .secrets
chmod 700 .secrets 2>/dev/null || true

if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" &>/dev/null; then
  gcloud iam service-accounts create "$SA_ID" \
    --display-name="Local: scene parts Firestore audit" \
    --project="$PROJECT"
else
  echo "Service account already exists: $SA_EMAIL"
fi

# Firestore (Admin SDK) list/query needs Datastore + project discovery roles.
set +e
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/datastore.user" \
  --quiet
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/serviceusage.serviceUsageConsumer" \
  --quiet
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/viewer" \
  --quiet
set -e
echo "IAM roles applied: datastore.user, serviceusage.serviceUsageConsumer, viewer (re-runs are idempotent)."

gcloud iam service-accounts keys create "$KEY_PATH" \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT"

chmod 600 "$KEY_PATH"
KEY_ABS="$ROOT/$KEY_PATH"
echo ""
echo "Wrote: $KEY_ABS"
echo "Add to .env.local (do not commit):"
echo "  GOOGLE_APPLICATION_CREDENTIALS=$KEY_PATH"
echo "Then: npm run audit:scene-parts"
