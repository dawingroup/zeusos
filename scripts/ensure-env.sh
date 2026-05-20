#!/usr/bin/env bash
# ensure-env.sh — Copy .env files from the main repo to the current worktree.
#
# Covers:
#   - ./.env              (Vite build — Firebase client config)
#   - ./functions/.env    (Cloud Functions deploy — QuickBooks/Notion/etc.)
#
# Run before `vite build`, `vite dev`, or `firebase deploy --only functions` from a worktree.
#
# Usage:
#   bash scripts/ensure-env.sh         (from worktree root)
# Also wired into the "prebuild" npm script.

MAIN_REPO="$(git worktree list --porcelain 2>/dev/null | head -1 | sed 's/worktree //')"
CURRENT_DIR="$(pwd)"

if [ -z "$MAIN_REPO" ]; then
  echo "[ensure-env] WARNING: Could not detect main repo. Skipping .env copy."
  exit 1
fi

# copy_env <relative-path>
#   Copies $MAIN_REPO/<path> → $CURRENT_DIR/<path> if the destination is missing
#   AND the source exists. Silent when the destination already exists.
copy_env() {
  local rel="$1"
  local src="$MAIN_REPO/$rel"
  local dst="$CURRENT_DIR/$rel"

  if [ -f "$dst" ]; then
    echo "[ensure-env] $rel already exists, skipping"
    return 0
  fi

  if [ ! -f "$src" ]; then
    echo "[ensure-env] no $rel in main repo, skipping"
    return 0
  fi

  # Ensure parent dir exists (e.g. functions/ in a fresh worktree)
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "[ensure-env] copied $rel from $MAIN_REPO"
}

copy_env ".env"
copy_env "functions/.env"
