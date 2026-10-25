#!/usr/bin/env bash
# deploy-branch-guard — refuse to deploy hosting from anywhere except a
# clean `main` worktree that is in lock-step with `origin/main`.
#
# Background: every worktree shares the same Firebase Hosting target. Any
# worktree can run `firebase deploy --only hosting` and overwrite the
# bundle produced by another worktree — even one based on a stale commit
# or carrying unpushed local commits. That is exactly how the May 2026
# Group-view deploy got overwritten by an off-main worktree minutes
# after release (see git log around commit 7d867f59).
#
# Wired as the FIRST step in `firebase.json` → `hosting.predeploy`, so it
# runs before the rebuild and bails out fast on a bad source state.
#
# Escape hatches (use deliberately, not by default):
#   - GITHUB_ACTIONS=true       → CI deploys always pass. The deploy-*.yml
#                                  workflows already build on `main` from
#                                  a known-good commit, so the guard is
#                                  redundant inside Actions runs.
#   - ZEUS_DEPLOY_GUARD=off    → human override for an intentional
#                                  hotfix from a feature branch.
#                                  REQUIRED ENV — prints a clear notice
#                                  so it is auditable in shell history.
#
# Exit codes: 0 pass / 1 hard fail. No stdout (firebase predeploy mixes
# stdout into the CLI JSON stream — see firebase-hosting-predeploy.sh
# comments). All output goes to stderr.

set -euo pipefail

note()  { printf '[deploy-guard] %s\n' "$*" >&2; }
fail()  { printf '\n[deploy-guard] BLOCKED: %s\n' "$*" >&2; }

# ── Skip in CI ────────────────────────────────────────────────────────────
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  note "GITHUB_ACTIONS=true — skipping guard (CI deploy)."
  exit 0
fi

# ── Skip via explicit override ───────────────────────────────────────────
if [[ "${ZEUS_DEPLOY_GUARD:-}" == "off" ]]; then
  note "ZEUS_DEPLOY_GUARD=off — guard bypassed."
  note "Reason should be recorded in shell history; proceeding."
  exit 0
fi

# ── Must be inside a git repo ────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a git work tree."
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# ── Refuse deploys from inside a .claude/worktrees/* sandbox ─────────────
# Those are sandboxes for parallel agents. Production deploys must come
# from the canonical checkout, not a sandbox.
if [[ "$ROOT" == *"/.claude/worktrees/"* ]]; then
  fail "Deploying from a sandbox worktree is not allowed."
  printf '  Worktree:  %s\n' "$ROOT" >&2
  printf '  Fix:       cd to the canonical checkout (the parent repo).\n' >&2
  printf '  Override:  ZEUS_DEPLOY_GUARD=off npm run deploy:hosting\n\n' >&2
  exit 1
fi

# ── Branch must be `main` ────────────────────────────────────────────────
BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  fail "Current branch is '$BRANCH', not 'main'."
  printf '  Fix:       git switch main && git pull --ff-only\n' >&2
  printf '  Override:  ZEUS_DEPLOY_GUARD=off npm run deploy:hosting\n\n' >&2
  exit 1
fi

# ── Working tree must be clean ───────────────────────────────────────────
# Ignore untracked dist/, .env, .tmp-firebase-config/ — they are expected.
#
# IMPORTANT: do NOT advise `git stash` / `git checkout` here. This is the
# canonical checkout, which is often shared by more than one agent session.
# Telling a deploying session to "stash to get a clean tree" makes it sweep
# away ANOTHER session's in-progress work — that is the recurring
# "my edits reverted to main" bug. So we abort and name the dirty files,
# and never suggest a destructive clean.
DIRTY="$(git status --porcelain --untracked-files=no)"
if [[ -n "$DIRTY" ]]; then
  fail "Working tree has uncommitted changes — refusing to deploy."
  printf '%s\n' "$DIRTY" >&2
  printf '\n  These changes may belong to ANOTHER active session sharing this\n' >&2
  printf '  checkout. Do NOT run `git stash` / `git checkout` / `git reset` to\n' >&2
  printf '  clear them — that destroys the other session'"'"'s work (this is the\n' >&2
  printf '  recurring revert bug).\n' >&2
  printf '\n  Safe options:\n' >&2
  printf '    - If the changes are YOURS: commit them to a branch, merge via PR,\n' >&2
  printf '      then deploy from a clean `main`.\n' >&2
  printf '    - If they are NOT yours: leave them. Deploy from CI, or from a\n' >&2
  printf '      dedicated clean clone — never from a shared dev checkout.\n' >&2
  printf '    - Intentional local hotfix you own:\n' >&2
  printf '        ZEUS_DEPLOY_GUARD=off npm run deploy:hosting\n\n' >&2
  exit 1
fi

# ── HEAD must be in lock-step with origin/main ───────────────────────────
# Refresh remote refs (offline failure is fine — we still compare against
# whatever we have locally; the user will be told to fetch if behind).
git fetch --quiet origin main 2>/dev/null || \
  note "warning: 'git fetch origin main' failed; comparing against last-known remote."

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse origin/main 2>/dev/null || echo 'unknown')"

if [[ "$REMOTE_SHA" == "unknown" ]]; then
  fail "Cannot resolve origin/main — fetch and retry."
  exit 1
fi

if [[ "$LOCAL_SHA" != "$REMOTE_SHA" ]]; then
  AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"
  BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
  fail "HEAD is out of sync with origin/main (ahead=$AHEAD, behind=$BEHIND)."
  printf '  Local HEAD:  %s\n' "$LOCAL_SHA" >&2
  printf '  origin/main: %s\n' "$REMOTE_SHA" >&2
  printf '\n  Fix:       git pull --ff-only   (if behind)\n' >&2
  printf '             push your branch and merge a PR (if ahead).\n' >&2
  printf '  Override:  ZEUS_DEPLOY_GUARD=off npm run deploy:hosting\n\n' >&2
  exit 1
fi

note "PASS — main @ $(echo "$LOCAL_SHA" | cut -c1-8) matches origin/main, clean tree."
exit 0
