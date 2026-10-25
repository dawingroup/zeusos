#!/usr/bin/env bash
# scripts/ci-gate.sh — run what CI runs, on this machine, with no GitHub involved.
#
# The zero-GitHub lane. When the Actions account is blocked, or a deploy has to
# happen from a laptop, this is what a change must pass before it is merged. It
# is the same checks as .github/workflows/ci.yml plus the repo guards, driven
# through the same npm scripts, so a green table here means what a green CI run
# means.
#
#   npm run gate              everything (the emulator suite needs a JDK)
#   npm run gate -- --fast    skip the emulator suite and the build
#   npm run gate -- --only unit,typecheck
#   npm run gate -- --list
#
# Every step runs even after an earlier one fails, so one pass reports every
# problem. Exit status is non-zero if any step failed.
set -uo pipefail

# CI_GATE_ROOT: gate a DIFFERENT tree than the one this file sits in. The local
# CI agent runs a pinned copy of this script against whatever commit it checked
# out, so a PR cannot weaken its own gate.
ROOT="${CI_GATE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$ROOT"

# firebase-tools' emulators need a JDK; Homebrew's lives here on the Macs this
# repo is developed on. Harmless when the directory does not exist.
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
export CI=true
export FORCE_COLOR=0

# ── the emulator teardown crash ────────────────────────────────────────────
# `firebase emulators:exec` sometimes dies AFTER its child script has exited 0,
# while it stops the emulators: an uncaught non-Firebase exception, which the
# CLI reports only as "Error: An unexpected error has occurred." with exit 2.
# Cause: the post-command usage-analytics POST timing out under its 5 s
# `withTimeout`. firebase-safe.sh runs the CLI with usage OFF, so this should
# no longer fire; the classifier stays as a backstop, and a PASS* means
# something NEW.
#
# This decides — from the step log and exit code ONLY — whether a failed
# emulator step is exactly that and nothing else. Every condition must hold:
#   · exit code 2 (errorOut's code for a non-Firebase error)
#   · exactly one "Script exited successfully (code 0)"
#   · no "Script exited unsuccessfully" / "with signal" anywhere
#   · after that line, only the shutdown bullets, then exactly one
#     "An unexpected error has occurred." — ANY other line disqualifies it
teardown_crash_only() {
  local log="$1" rc="$2"
  [ "$rc" = 2 ] || return 1
  sed $'s/\x1b\\[[0-9;]*m//g' "$log" | awk '
    /Script exited unsuccessfully|Script exited with signal/ { bad = 1 }
    /Script exited successfully \(code 0\)/ { ok++; after = 1; next }
    !after { next }
    /^[[:space:]]*$/ { next }
    /^i  emulators: Shutting down emulators\.$/ { shut = 1; next }
    shut && !crash && /^i  [a-z]+: Stopping [A-Za-z ]+$/ { next }
    shut && /^Error: An unexpected error has occurred\.$/ { crash++; next }
    { bad = 1 }
    END { exit !(ok == 1 && crash == 1 && !bad) }'
}

# Test hook: classify one step log without running anything.
if [ "${1:-}" = "--classify-teardown" ]; then
  teardown_crash_only "$2" "$3"; exit $?
fi

FAST=0
ONLY=""
LIST=0
for arg in "$@"; do
  case "$arg" in
    --fast) FAST=1 ;;
    --only=*) ONLY="${arg#--only=}" ;;
    --only) shift_next=1 ;;
    --list) LIST=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) if [ "${shift_next:-0}" = 1 ]; then ONLY="$arg"; shift_next=0; else echo "unknown argument: $arg" >&2; exit 2; fi ;;
  esac
done

# name | slow? | command            (slow steps are skipped by --fast)
# `lint` is advisory until the inherited ESLint backlog is paid down — the same
# `|| true` ci.yml uses — so it reports but never fails the gate.
STEPS=(
  "lint|0|npm run lint || echo '(lint is advisory — see CLAUDE.md)'"
  "functions-exports|0|npm run check:functions-exports"
  "deploy-params|0|npm run check:deploy-params"
  "typecheck|0|npx tsc --noEmit"
  "unit|0|npm run test:unit -- --run"
  "functions-tests|0|cd functions && npm test"
  "mcp-lint|0|cd zeusos-mcp-server && npm run lint"
  "mcp-vendor|0|npm run check:mcp-vendor"
  "rules-coverage|0|node scripts/check-rules-coverage.cjs"
  "rules-null-safety|0|node scripts/check-rules-null-safety.cjs"
  "rules-complexity|0|node scripts/check-rules-complexity.cjs"
  "rules-size|0|node scripts/build-firestore-rules.cjs"
  "rules-emulator|1|npm run test:rules:emulated"
  "build|1|npm run build"
)

if [ "$LIST" = 1 ]; then
  for s in "${STEPS[@]}"; do IFS='|' read -r name slow cmd <<<"$s"; printf '%-18s %s%s\n' "$name" "$cmd" "$([ "$slow" = 1 ] && echo '   (skipped by --fast)')"; done
  exit 0
fi

wanted() {
  local name="$1" slow="$2"
  if [ -n "$ONLY" ]; then [[ ",$ONLY," == *",$name,"* ]]; return; fi
  [ "$FAST" = 1 ] && [ "$slow" = 1 ] && return 1
  return 0
}

LOGDIR="${TMPDIR:-/tmp}/ci-gate/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"

# ── prerequisites the hosted runner gets for free ──────────────────────────
# A fresh clone has no node_modules anywhere; install what the selected steps
# need. `--prefer-offline` makes a warm npm cache nearly free. (A worktree
# whose node_modules is a symlink to the canonical checkout's is left alone.)
ensure_deps() {
  local dir="$1"
  if [ ! -d "$dir/node_modules" ] && [ ! -L "$dir/node_modules" ]; then
    echo "→ installing dependencies in $dir/ (none present)"
    (cd "$dir" && npm ci --prefer-offline --no-audit --no-fund >"$LOGDIR/npm-ci-$(basename "$dir").log" 2>&1) \
      || { echo "npm ci failed in $dir — see $LOGDIR/npm-ci-$(basename "$dir").log"; exit 1; }
  fi
}
ensure_deps "$ROOT"
wanted functions-tests 0 && ensure_deps "$ROOT/functions"
wanted mcp-lint 0 || wanted mcp-vendor 0 && ensure_deps "$ROOT/zeusos-mcp-server"

if wanted build 1 && [ ! -f "$ROOT/.env" ]; then
  echo "⚠ no .env in $ROOT — the build will produce a blank bundle. From a worktree:"
  echo "    cp /Users/danielonzimai/Developer/zeusos/.env \"$ROOT/.env\""
fi
if wanted rules-emulator 1 && ! command -v java >/dev/null 2>&1; then
  echo "⚠ no java on PATH — the emulator step will fail (brew install openjdk)."
fi
node_major=$(node -p 'process.versions.node.split(".")[0]')
if wanted functions-tests 0 && [ "$node_major" -lt 20 ]; then
  echo "⚠ node $node_major: the functions run on node 20; a local failure there may be the runtime, not the code."
fi

# ── run ────────────────────────────────────────────────────────────────────
declare -a NAMES RESULTS SECS
overall=0
for s in "${STEPS[@]}"; do
  IFS='|' read -r name slow cmd <<<"$s"
  wanted "$name" "$slow" || continue
  printf '\n━━ %s  ▶ %s\n' "$name" "$cmd"
  start=$(date +%s)
  # Each step's firebase CLI writes its debug log here instead of the tree
  # root, where the next successful emulators:exec would reuse and delete it.
  dbg="$LOGDIR/$name.firebase-debug.log"
  ( set -o pipefail; FIREBASE_DEBUG_PATH="$dbg" bash -c "$cmd" 2>&1 | tee "$LOGDIR/$name.log" | tail -n 0 )
  rc=$?
  if [ "$rc" = 0 ]; then
    res=PASS
  else
    if teardown_crash_only "$LOGDIR/$name.log" "$rc"; then
      res='PASS*'
      echo "⚠ $name: every test passed (the script exited 0); the firebase CLI then crashed while stopping the emulators (exit 2). Counted as PASS* — see the stack below."
    else
      res=FAIL; overall=1
      echo "── last 40 lines of $LOGDIR/$name.log:"
      tail -n 40 "$LOGDIR/$name.log"
    fi
    if [ -s "$dbg" ]; then
      echo "── last 60 lines of $dbg:"
      tail -n 60 "$dbg"
    fi
  fi
  NAMES+=("$name"); RESULTS+=("$res"); SECS+=("$(( $(date +%s) - start ))")
done

# ── summary ────────────────────────────────────────────────────────────────
printf '\n%-18s %-5s %6s\n' STEP RESULT SECS
printf '%-18s %-5s %6s\n' ------------------ ------ ------
for i in "${!NAMES[@]}"; do printf '%-18s %-5s %6s\n' "${NAMES[$i]}" "${RESULTS[$i]}" "${SECS[$i]}"; done
echo
if printf '%s\n' "${RESULTS[@]}" | grep -qxF 'PASS*'; then
  echo "PASS* = tests passed, then the firebase CLI crashed stopping the emulators (see the stack above)."
fi
if [ "$overall" = 0 ]; then
  echo "✔ gate passed — this is what a green CI run would have said. Logs: $LOGDIR"
else
  echo "✘ gate FAILED — do not merge. Logs: $LOGDIR"
fi
exit $overall
