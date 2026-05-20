#!/usr/bin/env bash
# Resolves a Firebase service-account JSON to `GOOGLE_APPLICATION_CREDENTIALS`
# and execs the rest of the command line. Used to bypass the locale-broken
# OAuth flow (`firebase login --reauth` / `gcloud auth login`) by pointing
# the Admin SDK at a downloaded service-account key file instead.
#
# Resolution order — first hit wins:
#   1. $GOOGLE_APPLICATION_CREDENTIALS already in env (caller knows best)
#   2. $DAWINOS_SA_KEY env var
#   3. `.dawinos-sa-key.json` in the repo root (gitignored)
#   4. `~/.dawinos/sa-key.json`
#   5. Auto-pick the newest `~/Downloads/dawinos-firebase-adminsdk-*.json`
#
# Usage:
#   ./scripts/with-sa-credentials.sh node scripts/seed-vela-boutique-portal.cjs --client-email …
#   ./scripts/with-sa-credentials.sh npx firebase hosting:channel:deploy portal-test
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_sa() {
  if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -f "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
    echo "${GOOGLE_APPLICATION_CREDENTIALS}"
    return 0
  fi
  if [[ -n "${DAWINOS_SA_KEY:-}" && -f "${DAWINOS_SA_KEY}" ]]; then
    echo "${DAWINOS_SA_KEY}"
    return 0
  fi
  if [[ -f "${REPO_ROOT}/.dawinos-sa-key.json" ]]; then
    echo "${REPO_ROOT}/.dawinos-sa-key.json"
    return 0
  fi
  if [[ -f "${HOME}/.dawinos/sa-key.json" ]]; then
    echo "${HOME}/.dawinos/sa-key.json"
    return 0
  fi
  # Last resort — newest matching key in Downloads.
  local newest
  newest="$(ls -t "${HOME}/Downloads"/dawinos-firebase-adminsdk-*.json 2>/dev/null | head -n1 || true)"
  if [[ -n "${newest}" && -f "${newest}" ]]; then
    echo "${newest}"
    return 0
  fi
  return 1
}

SA_PATH="$(resolve_sa)" || {
  cat >&2 <<EOF
✗ No Firebase service-account JSON found. Set one of:
    GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
    DAWINOS_SA_KEY=/path/to/sa.json
  or place the file at:
    ${REPO_ROOT}/.dawinos-sa-key.json   (gitignored)
    ${HOME}/.dawinos/sa-key.json
  or download from Firebase Console → Project settings → Service accounts.
EOF
  exit 1
}

export GOOGLE_APPLICATION_CREDENTIALS="${SA_PATH}"
echo "[with-sa] using ${SA_PATH}" >&2

# Firebase CLI 15.x prefers the user-account configstore over the SA
# env var, so if a stale user token sits there it still tries to
# refresh that and fails. We move the configstore aside for the
# duration of the command and restore on exit (incl. signal exits).
CONFIGSTORE_FILE="${HOME}/.config/configstore/firebase-tools.json"
CONFIGSTORE_BAK="${CONFIGSTORE_FILE}.with-sa.bak"
RESTORE_NEEDED=0
if [[ -f "${CONFIGSTORE_FILE}" ]]; then
  mv "${CONFIGSTORE_FILE}" "${CONFIGSTORE_BAK}"
  RESTORE_NEEDED=1
  echo "[with-sa] stashed firebase-tools configstore" >&2
fi
restore_configstore() {
  if [[ "${RESTORE_NEEDED}" -eq 1 && -f "${CONFIGSTORE_BAK}" ]]; then
    mv "${CONFIGSTORE_BAK}" "${CONFIGSTORE_FILE}"
    echo "[with-sa] restored firebase-tools configstore" >&2
  fi
}
trap restore_configstore EXIT INT TERM

"$@"
