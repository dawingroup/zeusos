#!/bin/bash
set -euo pipefail

# Runs firebase-tools with a workspace-local config store so update checks
# and auth writes do not depend on ~/.config permissions.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_CONFIG_DIR="$ROOT_DIR/.tmp-firebase-config"
LOCAL_CONFIGSTORE_DIR="$LOCAL_CONFIG_DIR/configstore"
HOME_CONFIGSTORE_FILE="$HOME/.config/configstore/firebase-tools.json"
LOCAL_CONFIGSTORE_FILE="$LOCAL_CONFIGSTORE_DIR/firebase-tools.json"

mkdir -p "$LOCAL_CONFIGSTORE_DIR"

# Seed local config/auth from the user's home config when available.
# Always refresh so stale/empty local files do not break authentication.
if [[ -f "$HOME_CONFIGSTORE_FILE" ]]; then
  cp "$HOME_CONFIGSTORE_FILE" "$LOCAL_CONFIGSTORE_FILE"
fi

XDG_CONFIG_HOME="$LOCAL_CONFIG_DIR" \
FIREBASE_SKIP_UPDATE_CHECK=1 \
CI=1 \
npx -y firebase-tools@latest "$@"
