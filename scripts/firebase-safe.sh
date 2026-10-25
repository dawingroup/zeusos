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

# Usage analytics OFF in this copy (never in the user's own file). With it on,
# every command ends by POSTing to Google Analytics under a 5-second
# `withTimeout` (firebase-tools lib/command.js); when that POST is slow the
# timeout's plain `Error: Timed out.` goes to errorOut, which prints
# "Error: An unexpected error has occurred." and exits 2 — AFTER the command
# succeeded. It fails emulator steps with every test green, and a deploy that
# shipped can report the same failure. With `usage` false the CLI makes no
# analytics session, so nothing is sent and no timer runs.
node -e '
  const fs = require("fs"), f = process.argv[1];
  let c = {};
  try { c = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
  c.usage = false;
  fs.writeFileSync(f, JSON.stringify(c, null, "\t"));
' "$LOCAL_CONFIGSTORE_FILE"

# ── Cross-worktree deploy lock ───────────────────────────────────────────────
# Only one deploy may run at a time across ALL worktrees that share this repo.
# Two concurrent deploys race on the same Firebase Hosting target and tempt a
# session into `git stash`-ing a shared tree to get a clean deploy (the
# recurring revert bug). The lock lives in the shared git common dir, so every
# worktree contends for the SAME lock. macOS ships no `flock`, so we use an
# atomic `mkdir` lock with PID-based staleness reclaim.
needs_lock=0
case "${1:-}" in
  deploy|hosting:channel:deploy) needs_lock=1 ;;
esac

if [[ "$needs_lock" == "1" ]]; then
  GIT_COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null || echo "$ROOT_DIR/.git")"
  case "$GIT_COMMON_DIR" in
    /*) : ;;                                   # already absolute
    *)  GIT_COMMON_DIR="$ROOT_DIR/$GIT_COMMON_DIR" ;;
  esac
  # ZEUS_DEPLOY_LOCK_DIR lets a SEPARATE CLONE (the local CI agent's,
  # scripts/local-ci/) contend for the canonical checkout's lock — a clone has
  # its own git common-dir, so without this its deploys would not serialize
  # against a manual `npm run deploy*` from the canonical checkout.
  LOCK_DIR="${ZEUS_DEPLOY_LOCK_DIR:-$GIT_COMMON_DIR/zeus-deploy.lock}"
  LOCK_META="$LOCK_DIR/holder"
  LOCK_WAIT_SECS="${ZEUS_DEPLOY_LOCK_WAIT:-180}"

  waited=0
  while true; do
    if mkdir "$LOCK_DIR" 2>/dev/null; then
      printf 'pid=%s\ncwd=%s\nuser=%s\nstarted=%s\n' \
        "$$" "$(pwd)" "${USER:-unknown}" "$(date '+%Y-%m-%d %H:%M:%S')" > "$LOCK_META"
      trap 'rm -rf "$LOCK_DIR"' EXIT INT TERM
      break
    fi

    # Lock is held — inspect the holder.
    holder_pid=""
    if [[ -f "$LOCK_META" ]]; then
      holder_pid="$(sed -n 's/^pid=//p' "$LOCK_META" 2>/dev/null || true)"
    fi

    # Reclaim if the holder process is gone (crashed without releasing).
    if [[ -n "$holder_pid" ]] && ! kill -0 "$holder_pid" 2>/dev/null; then
      echo "[deploy-lock] reclaiming stale lock from dead PID $holder_pid" >&2
      rm -rf "$LOCK_DIR"
      continue
    fi

    if (( waited >= LOCK_WAIT_SECS )); then
      echo "[deploy-lock] BLOCKED: another deploy is in progress and did not" >&2
      echo "              finish within ${LOCK_WAIT_SECS}s." >&2
      if [[ -f "$LOCK_META" ]]; then
        echo "  Holder:" >&2
        sed 's/^/    /' "$LOCK_META" >&2
      fi
      echo "  Wait for it to finish, then retry. Override the wait with" >&2
      echo "  ZEUS_DEPLOY_LOCK_WAIT=<seconds>." >&2
      exit 1
    fi

    if (( waited == 0 )); then
      echo "[deploy-lock] another deploy is running; waiting up to ${LOCK_WAIT_SECS}s..." >&2
    fi
    sleep 3
    waited=$(( waited + 3 ))
  done
fi

# The CLI version is PINNED in .firebase-tools-version. `@latest` lets the
# version change between two runs of the same commit, so a CLI regression reads
# as a code failure and nothing can be reproduced. To bump: put the new version
# in that file, run `npm run test:rules:emulated` locally, and ship the bump as
# its own PR so a failure points at the CLI and nothing else.
# FIREBASE_TOOLS_VERSION overrides it for a one-off trial of another version.
FIREBASE_TOOLS_VERSION="${FIREBASE_TOOLS_VERSION:-$(tr -d '[:space:]' < "$ROOT_DIR/.firebase-tools-version")}"
if [[ ! "$FIREBASE_TOOLS_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "firebase-safe: .firebase-tools-version must hold an exact x.y.z version, got '$FIREBASE_TOOLS_VERSION'" >&2
  exit 1
fi

XDG_CONFIG_HOME="$LOCAL_CONFIG_DIR" \
FIREBASE_SKIP_UPDATE_CHECK=1 \
CI=1 \
npx -y "firebase-tools@$FIREBASE_TOOLS_VERSION" "$@"
