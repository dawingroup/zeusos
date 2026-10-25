#!/usr/bin/env bash
# deploy-functions-guard — refuse a functions deploy from a tree that does not
# contain all of origin/main.
#
# ── THE BUG THIS EXISTS FOR (2026-08-09) ─────────────────────────────────────
# `firebase deploy` packages WHATEVER TREE YOU INVOKE IT FROM. There is one
# `default` codebase, so every function shares one archive — and the archive is
# built from your working directory, not from a git ref.
#
# On 2026-08-09, 13 functions were deployed for the #1074 dependency refresh.
# Twelve came from a detached checkout at the merge commit and picked up the
# patched versions. `dawinos_mcp` was deployed from the canonical checkout,
# which was SIX COMMITS BEHIND main, so it shipped the pre-#1074 lockfile and
# kept running five vulnerable packages (fast-uri 3.1.4, brace-expansion 2.1.2,
# ip-address 10.2.0, hono 4.12.27, @hono/node-server 1.19.14).
#
# Nothing surfaced it. The CLI printed "Successful update operation." The
# per-function `hash` looks different for every function regardless of source,
# so it proves nothing. The Cloud Build log runs `npm ci --quiet`, which never
# names a package version. The stale deploy was only found by downloading
# `function-source.zip` from GCS and diffing the lockfile inside it — see
# feedback_verify_deployed_functions_by_source_archive.
#
# A silent stale deploy is worse than a failed one: it looks shipped.
#
# ── WHAT THIS CHECKS ─────────────────────────────────────────────────────────
# HEAD must CONTAIN all of origin/main (`git rev-list --count HEAD..origin/main`
# == 0). Deliberately NOT "branch must be main":
#   - functions are legitimately deployed from unmerged branches here (the
#     WhatsApp #407 case), and
#   - a branch rebased on current main is not stale.
# Being AHEAD of origin/main is fine and is not flagged — that is the branch
# deploy case. Only being BEHIND is the hazard.
#
# Wired as the FIRST step in `firebase.json` → `functions.predeploy` so it runs
# on EVERY functions deploy, including a bare `npx firebase deploy --only
# functions:foo` that bypasses `scripts/firebase-safe.sh`. That bypass is how
# the original incident happened, so guarding only the npm scripts would not
# have caught it. It runs before the zeusos-mcp-server build so a bad tree
# fails in a second rather than after a full `npm ci` + `tsc`.
#
# Escape hatches (match deploy-branch-guard.sh so there is one thing to remember):
#   - GITHUB_ACTIONS=true    → CI deploys from a known-good checkout.
#   - ZEUS_DEPLOY_GUARD=off → deliberate human override; prints a notice so it
#                              is auditable in shell history.
#
# Exit codes: 0 pass / 1 hard fail. ALL output goes to stderr — firebase mixes
# predeploy stdout into the CLI JSON stream (see firebase-hosting-predeploy.sh).

set -euo pipefail

note() { printf '[functions-guard] %s\n' "$*" >&2; }
fail() { printf '\n[functions-guard] BLOCKED: %s\n' "$*" >&2; }

# ── Skip in CI ───────────────────────────────────────────────────────────────
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  note "GITHUB_ACTIONS=true — skipping guard (CI deploy)."
  exit 0
fi

# ── Skip via explicit override ───────────────────────────────────────────────
if [[ "${ZEUS_DEPLOY_GUARD:-}" == "off" ]]; then
  note "ZEUS_DEPLOY_GUARD=off — guard bypassed."
  note "Reason should be recorded in shell history; proceeding."
  exit 0
fi

# ── Must be inside a git repo ────────────────────────────────────────────────
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fail "Not inside a git work tree — cannot tell whether the source is current."
  printf '  Override:  ZEUS_DEPLOY_GUARD=off npx firebase deploy --only functions\n\n' >&2
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

# Refresh remote refs. An offline failure is NOT fatal: we still compare against
# the last-known origin/main, which catches the six-commits-behind case even
# without a network. Silence would be the wrong call — say which it was.
if ! git fetch --quiet origin main 2>/dev/null; then
  note "warning: 'git fetch origin main' failed — comparing against the LAST-KNOWN"
  note "         origin/main. A tree that went stale since the last fetch can slip through."
fi

if ! REMOTE_SHA="$(git rev-parse origin/main 2>/dev/null)"; then
  fail "Cannot resolve origin/main — fetch and retry."
  printf '  Fix:       git fetch origin main\n' >&2
  printf '  Override:  ZEUS_DEPLOY_GUARD=off npx firebase deploy --only functions\n\n' >&2
  exit 1
fi

BEHIND="$(git rev-list --count HEAD..origin/main 2>/dev/null || echo '?')"
AHEAD="$(git rev-list --count origin/main..HEAD 2>/dev/null || echo '?')"

# Block on what actually changes the deployed artifact, not on any drift at all.
#
# Only two paths land in the uploaded archive: functions/ itself, and
# zeusos-mcp-server/, which predeploy compiles into functions/vendor/. Missing
# a commit that touches neither (a src/ UI change, a docs tweak) leaves every
# deployed container byte-identical, so blocking it would be a false alarm —
# and a guard that cries wolf gets `ZEUS_DEPLOY_GUARD=off` pasted in front of
# it permanently, which is strictly worse than no guard. Warn there, block here.
MISSING="$(git log --oneline --no-decorate HEAD..origin/main -- functions/ zeusos-mcp-server/ 2>/dev/null || true)"

if [[ -n "$MISSING" ]]; then
  MISSING_N="$(printf '%s\n' "$MISSING" | grep -c . || true)"
  fail "This tree is missing $MISSING_N commit(s) that change what gets deployed."
  printf '  HEAD:        %s (%s)\n' "$(git rev-parse --short HEAD)" "$(git branch --show-current || echo 'detached')" >&2
  printf '  origin/main: %s  (behind %s total)\n' "$(echo "$REMOTE_SHA" | cut -c1-8)" "$BEHIND" >&2
  printf '\n  firebase packages the WORKING TREE, so this deploy would ship code and a\n' >&2
  printf '  package-lock.json that are out of date — silently. The CLI would still\n' >&2
  printf '  print "Successful update operation", and the per-function hash and the\n' >&2
  printf '  Cloud Build log would both look normal.\n' >&2
  printf '\n  Missing commits touching functions/ or zeusos-mcp-server/:\n' >&2
  printf '%s\n' "$MISSING" | head -10 | sed 's/^/    /' >&2
  [[ "$MISSING_N" -gt 10 ]] && printf '    … and %s more\n' "$((MISSING_N - 10))" >&2
  printf '\n  Fix:       git pull --ff-only          (on main)\n' >&2
  printf '             git rebase origin/main       (on a branch)\n' >&2
  printf '  Override:  ZEUS_DEPLOY_GUARD=off npx firebase deploy --only functions:NAME\n\n' >&2
  exit 1
fi

if [[ "$BEHIND" != "0" ]]; then
  note "behind origin/main by $BEHIND commit(s), but none touch functions/ or"
  note "zeusos-mcp-server/ — the packaged archive is unaffected. Proceeding."
fi

# Uncommitted changes are packaged too, so the deployed bundle would contain code
# that exists in no commit. That is a real hazard, but unlike staleness it is
# usually deliberate (testing a fix against live) and blocking it would break an
# established workflow — so warn loudly and continue.
DIRTY="$(git status --porcelain --untracked-files=no -- functions/ zeusos-mcp-server/ 2>/dev/null || true)"
if [[ -n "$DIRTY" ]]; then
  note "WARNING: uncommitted changes under functions/ or zeusos-mcp-server/ WILL be"
  note "         packaged and deployed. They exist in no commit — nobody can review or"
  note "         reproduce what ships. Files:"
  printf '%s\n' "$DIRTY" | sed 's/^/           /' >&2
fi

note "PASS — HEAD $(git rev-parse --short HEAD) has every functions/ change on origin/main$([[ "$AHEAD" != "0" ]] && echo " (ahead $AHEAD)")."
exit 0
