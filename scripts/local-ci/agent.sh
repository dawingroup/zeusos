#!/bin/bash
# scripts/local-ci/agent.sh — CI and deploys without GitHub Actions, on this Mac.
#
# ZeusOS's deploy workflows are broken (the FIREBASE_TOKEN secret was revoked)
# while the CI workflow still runs on every push. This agent is the deploy lane
# and, when Actions is blocked outright, the gate too. launchd runs it every
# few minutes; it asks GitHub (plain REST — not Actions) for the tip of `main`
# and open PR heads, then:
#
#   · GATE — when Actions is not running jobs (a billing block: runs end
#     `startup_failure` with no jobs, or `failure` with zero-step jobs) it runs
#     the SAME gate CI runs
#     (scripts/ci-gate.sh) in its own clone and posts the verdict on the commit
#     as the status `local-ci/gate`. While Actions is alive it takes main's
#     verdict from the CI workflow run instead and gates no PRs.
#   · DEPLOY — when `main` is green and not yet live it deploys through the
#     guarded npm scripts: rules/indexes/storage (only the targets whose files
#     moved), every function in functions/index.js when functions/ or
#     zeusos-mcp-server/ changed (firebase skips the unchanged ones), then
#     hosting, proved by content — and posts `local-ci/deploy`.
#
# It runs a PINNED copy of itself and of ci-gate.sh (~/.zeusos-local-ci/bin,
# written by ctl.sh install), never the copy in the tree under test: a checked-
# out PR must not be able to rewrite its own gate.
#
# Config (sourced from ~/.zeusos-local-ci/config): REPO CANONICAL PR_SINCE
# PR_MODE DEPLOY DEPLOY_WHEN_ACTIONS_ALIVE HOSTING_URL. With
# DEPLOY_WHEN_ACTIONS_ALIVE=0 the agent stands down entirely while Actions
# works (two deploy lanes are worse than none — set it to 0 once the deploy
# workflows have a working token again).
#
#   LOCAL_CI_DRY_RUN=1   say what would happen; post nothing, deploy nothing
#   LOCAL_CI_FORCE=1     gate locally even though Actions looks alive
set -uo pipefail

LCI_HOME="${LOCAL_CI_HOME:-$HOME/.zeusos-local-ci}"
CONFIG="$LCI_HOME/config"
[ -f "$CONFIG" ] || { echo "no $CONFIG — run scripts/local-ci/ctl.sh install" >&2; exit 1; }
# shellcheck disable=SC1090
. "$CONFIG"

CLONE="$LCI_HOME/repo"
BIN="$LCI_HOME/bin"
STATE="$LCI_HOME/state"
LOGS="$LCI_HOME/logs"
DRY="${LOCAL_CI_DRY_RUN:-0}"
HOSTING_URL="${HOSTING_URL:-https://zeusos.web.app/}"
mkdir -p "$STATE/gated" "$STATE/deploy-failed" "$LOGS"

export PATH="/opt/homebrew/bin:/opt/homebrew/opt/openjdk/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# A dry run changes nothing, so it may rehearse while the agent is disabled.
[ -f "$LCI_HOME/DISABLED" ] && [ "$DRY" != 1 ] && exit 0

# ── one tick at a time ─────────────────────────────────────────────────────
LOCK="$LCI_HOME/agent.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  holder="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then exit 0; fi
  log "reclaiming stale lock from dead pid ${holder:-?}"
  rm -rf "$LOCK"; mkdir "$LOCK" || exit 0
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM

# A gate is 10-30 minutes and a deploy must not be cut in half by idle sleep.
caffeinate -i -w $$ >/dev/null 2>&1 &

post_status() { # sha state context description
  local desc="${4:0:138}"
  if [ "$DRY" = 1 ]; then log "DRY status $1 $3=$2 — $desc"; return 0; fi
  gh api -X POST "repos/$REPO/statuses/$1" -f state="$2" -f context="$3" -f description="$desc" >/dev/null 2>&1 \
    || log "warning: could not post status $3=$2 on ${1:0:9}"
}

# ── is Actions running jobs? ───────────────────────────────────────────────
# "Alive" means jobs actually EXECUTE. A billing block shows up two ways: runs
# that end `startup_failure` with no jobs, and (seen 2026-10-25) runs that end
# `failure` whose every job completed in ~2 s with ZERO steps and the
# annotation "The job was not started because your account is locked due to a
# billing issue". Neither is a verdict on the commit. So a run counts only when
# it is in progress or one of its jobs ran at least one step; the six newest
# runs are enough to tell, and few enough to ask about every tick.
runs="$(gh api "repos/$REPO/actions/runs?per_page=6" --jq '.workflow_runs[] | "\(.id) \(.status) \(.conclusion // "none")"' 2>/dev/null)"
if [ -z "$runs" ]; then log "cannot reach the GitHub API — skipping this tick"; exit 0; fi
alive=0
while read -r rid rstatus rconcl; do
  [ -z "$rid" ] && continue
  case "$rstatus" in in_progress|queued|waiting|requested|pending) alive=1; break ;; esac
  [ "$rconcl" = startup_failure ] && continue
  stepped="$(gh api "repos/$REPO/actions/runs/$rid/jobs?per_page=50" --jq '[.jobs[] | select((.steps|length) > 0)] | length' 2>/dev/null || echo 0)"
  [ "${stepped:-0}" != 0 ] && { alive=1; break; }
done <<<"$runs"
ACTIONS_ALIVE=$alive
GATE_LOCALLY=1
if [ "$ACTIONS_ALIVE" = 1 ] && [ "${LOCAL_CI_FORCE:-0}" != 1 ]; then
  GATE_LOCALLY=0
  if [ "${DEPLOY_WHEN_ACTIONS_ALIVE:-1}" != 1 ]; then
    if [ ! -f "$STATE/stood-down" ]; then
      log "GitHub Actions is running jobs again ($alive of the last 15 runs) and DEPLOY_WHEN_ACTIONS_ALIVE=0 — standing down."
      date > "$STATE/stood-down"
    fi
    exit 0
  fi
fi
rm -f "$STATE/stood-down"

# The CI workflow's verdict for a commit, from GitHub: success | failure | pending | none.
ci_verdict_on_github() { # sha
  gh run list --repo "$REPO" --commit "$1" --workflow ci.yml --json status,conclusion \
    --jq 'if length==0 then "none" elif any(.status!="completed") then "pending" elif all(.conclusion=="success") then "success" else "failure" end' 2>/dev/null \
    || echo none
}

# The emulator suite binds fixed ports. A session running it right now would
# make this gate fail for no fault of the commit — wait for the next tick.
if [ "$GATE_LOCALLY" = 1 ] && { lsof -nP -iTCP:8080 -sTCP:LISTEN >/dev/null 2>&1 || lsof -nP -iTCP:9099 -sTCP:LISTEN >/dev/null 2>&1; }; then
  log "emulator ports 8080/9099 are in use — deferring"
  exit 0
fi

cd "$CLONE" || { log "no clone at $CLONE"; exit 1; }
git fetch -q --prune origin main || { log "git fetch failed — skipping this tick"; exit 0; }

# ── helpers ────────────────────────────────────────────────────────────────
lock_hash() { cat package-lock.json functions/package-lock.json zeusos-mcp-server/package-lock.json 2>/dev/null | shasum | cut -d' ' -f1; }

prepare_tree() { # sha kind(main|pr)
  if [ "$2" = main ]; then git checkout -q -f -B main "$1"; else git checkout -q -f --detach "$1"; fi || return 1
  git clean -fdq                                  # ignored files (node_modules, .env, dist) survive
  cp "$CANONICAL/.env" .env 2>/dev/null && sed -i '' 's/^VITE_DEV_BYPASS_AUTH=.*/VITE_DEV_BYPASS_AUTH=false/' .env
  local want; want="$(lock_hash)"
  if [ "$(cat "$STATE/lock-hash" 2>/dev/null)" != "$want" ] || [ ! -d node_modules ]; then
    log "lockfiles changed — npm ci ×3"
    for d in . functions zeusos-mcp-server; do
      (cd "$d" && npm ci --prefer-offline --no-audit --no-fund >"$LOGS/npm-ci.log" 2>&1) || { log "npm ci failed in $d (see $LOGS/npm-ci.log)"; return 1; }
    done
    echo "$want" > "$STATE/lock-hash"
  fi
}

docs_only() { # sha — true when every changed file is *.md or under docs/
  local base files
  base="$(git merge-base origin/main "$1" 2>/dev/null)" || return 1
  files="$(git diff --name-only "$base" "$1")"
  [ -n "$files" ] && ! echo "$files" | grep -qvE '(\.md$|^docs/)'
}

run_gate() { # sha kind label  → 0 pass, 1 fail
  local sha="$1" kind="$2" label="$3" glog="$LOGS/${1:0:12}-gate.log" args=""
  [ "$kind" = pr ] && [ "${PR_MODE:-full}" = fast ] && args="--fast"
  if [ "$DRY" = 1 ]; then log "DRY would gate $label ${sha:0:9} ${args}"; return 0; fi
  log "gating $label ${sha:0:9} ${args}"
  post_status "$sha" pending local-ci/gate "running on $(scutil --get LocalHostName 2>/dev/null || hostname -s) since $(date '+%H:%M')"
  if ! prepare_tree "$sha" "$kind"; then
    post_status "$sha" error local-ci/gate "could not prepare the tree (checkout / npm ci) — see the agent log"
    echo error > "$STATE/gated/$sha"; return 1
  fi
  local start; start=$(date +%s)
  CI_GATE_ROOT="$CLONE" bash "$BIN/ci-gate.sh" $args >"$glog" 2>&1
  local rc=$? mins=$(( ($(date +%s) - start) / 60 ))
  if [ $rc = 0 ]; then
    local crashed skipped
    crashed="$(awk '/^STEP +RESULT/{t=1;next} t && $2=="PASS*"{print $1}' "$glog" | paste -sd, -)"
    skipped="$(awk '/^STEP +RESULT/{t=1;next} t && $2=="SKIP"{print $1}' "$glog" | paste -sd, -)"
    post_status "$sha" success local-ci/gate "passed locally in ${mins}m${args:+ (fast: no emulators, no build)}${skipped:+ — not run, tree predates #163: $skipped}${crashed:+ (CLI crashed at emulator shutdown after $crashed passed)}"
    echo pass > "$STATE/gated/$sha"; log "PASS $label ${sha:0:9} (${mins}m)${crashed:+ — CLI teardown crash in $crashed: $glog}"; return 0
  fi
  failed_steps() { awk '/^STEP +RESULT/{t=1;next} t && $2=="FAIL"{print $1}' "$1" | paste -sd, -; }
  local failed; failed="$(failed_steps "$glog")"
  # One retry of just the failed steps before a commit is called red — this is
  # a laptop with sessions running on it, and a 10s unit-test timeout is the
  # usual false red. A person re-runs a flaky CI job; this does the same, once.
  if [ -n "$failed" ]; then
    log "retrying $label ${sha:0:9}: $failed"
    if CI_GATE_ROOT="$CLONE" bash "$BIN/ci-gate.sh" --only "$failed" >"$glog.retry" 2>&1; then
      mins=$(( ($(date +%s) - start) / 60 ))
      post_status "$sha" success local-ci/gate "passed locally in ${mins}m ($failed passed on a retry — flaky here, worth a look)"
      echo "pass-after-retry:$failed" > "$STATE/gated/$sha"; log "PASS-ON-RETRY $label ${sha:0:9}: $failed (${mins}m)"; return 0
    fi
    failed="$(failed_steps "$glog.retry")"; mins=$(( ($(date +%s) - start) / 60 ))
  fi
  post_status "$sha" failure local-ci/gate "FAILED: ${failed:-see log} (${mins}m) — reproduce: npm run gate -- --only ${failed:-<step>}"
  echo "fail:$failed" > "$STATE/gated/$sha"; log "FAIL $label ${sha:0:9}: $failed — $glog"; return 1
}

changed_outside() { # from to — true when the diff touches anything the hosting bundle could contain
  git diff --name-only "$1" "$2" | grep -qvE '^(functions/|zeusos-mcp-server/|docs/|\.github/|scripts/|tests/|e2e/)|\.md$'
}
functions_changed() { # from to
  git diff --name-only "$1" "$2" | grep -qE '^(functions/|zeusos-mcp-server/)'
}
# Every export in functions/index.js as one --only list. firebase skips the
# functions whose source did not change, so naming all of them is the cheap,
# complete plan (CLAUDE.md → deploy all functions in ONE --only).
all_function_targets() {
  grep -oE '^exports\.[A-Za-z0-9_]+' functions/index.js | sed 's/^exports\./functions:/' | sort -u | paste -sd, -
}

deploy_main() { # sha
  local sha="$1" dlog="$LOGS/${1:0:12}-deploy.log" did="" last
  export ZEUS_DEPLOY_LOCK_DIR="$CANONICAL/.git/zeus-deploy.lock" ZEUS_DEPLOY_LOCK_WAIT=1800
  : > "$dlog"
  fail() { post_status "$sha" failure local-ci/deploy "$1 — nothing later ran; see the agent log"; log "DEPLOY FAILED ${sha:0:9}: $1 — $dlog"; touch "$STATE/deploy-failed/$sha"; return 1; }

  if [ "$(git rev-parse origin/main)" != "$sha" ]; then log "${sha:0:9} is no longer the tip of main — leaving the deploy to the newer commit"; return 0; fi
  post_status "$sha" pending local-ci/deploy "deploying from $(scutil --get LocalHostName 2>/dev/null || hostname -s)"

  # 1. rules / indexes / storage — only the TARGETS whose files moved. Never
  # name `firestore:rules` for an unchanged ruleset: the CLI skips the upload
  # and then POSTs a release that already exists — HTTP 409 — after the indexes
  # and storage rules shipped. If a 409 still happens, this is a FAIL to look
  # at by hand: verify the live ruleset by content (CLAUDE.md → Deploy hygiene).
  last="$(cat "$STATE/deployed-infra" 2>/dev/null || echo "$sha")"
  moved="$(git diff --name-only "$last" "$sha" | grep -E '^(firestore\.rules|firestore\.indexes\.json|storage\.rules|scripts/build-firestore-rules\.cjs|firebase\.json)$' || true)"
  if [ -n "$moved" ]; then
    targets=""
    echo "$moved" | grep -qE '^(firestore\.rules|scripts/build-firestore-rules\.cjs|firebase\.json)$' && targets="$targets,firestore:rules"
    echo "$moved" | grep -qE '^(firestore\.indexes\.json|firebase\.json)$' && targets="$targets,firestore:indexes"
    echo "$moved" | grep -qE '^(storage\.rules|firebase\.json)$' && targets="$targets,storage"
    targets="${targets#,}"
    log "deploying $targets"
    if ! npm run deploy -- --only "$targets" --non-interactive >>"$dlog" 2>&1; then
      if grep -q 'HTTP Error: 409, Requested entity already exists' "$dlog"; then
        fail "$targets: rules release 409 — the ruleset may already be live; verify by content before retrying (ctl.sh retry deploy)"
      else
        fail "$targets deploy failed"
      fi
      return 1
    fi
    did="$did infra"
  fi
  echo "$sha" > "$STATE/deployed-infra"

  # 2. functions — every export, when anything that lands in the archive changed
  last="$(cat "$STATE/deployed-functions" 2>/dev/null || true)"
  if [ -n "$last" ] && [ "$last" != "$sha" ] && functions_changed "$last" "$sha"; then
    local list count ok skipped bad
    list="$(all_function_targets)"
    count="$(echo "$list" | tr ',' '\n' | grep -c .)"
    log "deploying functions ($count export(s) named; unchanged ones are skipped by the CLI)"
    npm run deploy -- --only "$list" --non-interactive >>"$dlog" 2>&1 || { fail "functions deploy exited non-zero"; return 1; }
    ok="$(grep -acE 'Successful (create|update) operation' "$dlog")"
    skipped="$(grep -acE 'Skipping the deploy of unchanged functions|unchanged' "$dlog")"
    bad="$(grep -acE 'failed to (update|create) function|Container Healthcheck failed' "$dlog")"
    if [ "$bad" != 0 ]; then fail "functions: $bad failed ($ok succeeded) — quota? redeploy the stragglers"; return 1; fi
    did="$did functions($ok updated${skipped:+, rest unchanged})"
  fi
  echo "$sha" > "$STATE/deployed-functions"

  # 3. hosting — functions first, so the client never calls a callable that is not there yet
  last="$(cat "$STATE/deployed-hosting" 2>/dev/null || true)"
  if [ -z "$last" ] || changed_outside "$last" "$sha"; then
    log "deploying hosting"
    npm run deploy:hosting >>"$dlog" 2>&1 || { fail "hosting deploy failed (guard or build)"; return 1; }
    # Proof by content: the entry chunk we just built is the one being served.
    local built live i
    built="$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' dist/index.html | head -1)"
    for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
      live="$(curl -s --max-time 20 "$HOSTING_URL" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)"
      [ -n "$built" ] && [ "$built" = "$live" ] && break
      sleep 10
    done
    if [ -z "$built" ] || [ "$built" != "$live" ]; then fail "hosting deployed but the live entry chunk ($live) is not the built one ($built)"; return 1; fi
    did="$did hosting"
  fi
  echo "$sha" > "$STATE/deployed-hosting"

  printf '%s %s%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$sha" "${did:- (nothing to deploy)}" >> "$LCI_HOME/deploys.log"
  post_status "$sha" success local-ci/deploy "live:${did:- nothing to deploy for this commit}"
  log "DEPLOYED ${sha:0:9}:${did:- nothing to deploy}"
}

# ── main first: it is the one that ships ───────────────────────────────────
MAIN_SHA="$(git rev-parse origin/main)"
if [ ! -f "$STATE/gated/$MAIN_SHA" ]; then
  if [ "$GATE_LOCALLY" = 1 ]; then
    run_gate "$MAIN_SHA" main "main"
  else
    verdict="$(ci_verdict_on_github "$MAIN_SHA")"
    case "$verdict" in
      success) [ "$DRY" = 1 ] || echo pass-github > "$STATE/gated/$MAIN_SHA"; log "main ${MAIN_SHA:0:9} is green on GitHub CI" ;;
      failure) [ "$DRY" = 1 ] || echo fail-github > "$STATE/gated/$MAIN_SHA"; log "main ${MAIN_SHA:0:9} is RED on GitHub CI — not deploying" ;;
      *) log "main ${MAIN_SHA:0:9}: GitHub CI is $verdict — waiting" ;;
    esac
  fi
fi
if [ "${DEPLOY:-1}" = 1 ] && [ "$DRY" != 1 ] && grep -qE '^pass' "$STATE/gated/$MAIN_SHA" 2>/dev/null \
   && [ ! -f "$STATE/deploy-failed/$MAIN_SHA" ] \
   && [ "$(cat "$STATE/deployed-hosting" 2>/dev/null)$(cat "$STATE/deployed-functions" 2>/dev/null)$(cat "$STATE/deployed-infra" 2>/dev/null)" != "$MAIN_SHA$MAIN_SHA$MAIN_SHA" ]; then
  prepare_tree "$MAIN_SHA" main && deploy_main "$MAIN_SHA"
fi
[ "$DRY" = 1 ] && log "DRY would deploy main ${MAIN_SHA:0:9} if green and not yet live (infra/functions/hosting pointers: $(cut -c1-9 "$STATE/deployed-infra" 2>/dev/null || echo -)/$(cut -c1-9 "$STATE/deployed-functions" 2>/dev/null || echo -)/$(cut -c1-9 "$STATE/deployed-hosting" 2>/dev/null || echo -))"

# ── then open PRs — only when Actions cannot gate them itself ──────────────
# Every open PR whatever its base: a stacked PR (a port stream on top of the
# one it needs) is gated by its head commit, which carries the whole chain.
# Oldest updatedAt first, gated heads skipped: a first-in-first-out queue.
[ "$GATE_LOCALLY" = 1 ] || exit 0
gh pr list --repo "$REPO" --state open --limit 100 \
  --json number,headRefOid,isDraft,isCrossRepository,updatedAt \
  --jq "sort_by(.updatedAt) | .[] | select(.isDraft|not) | select(.isCrossRepository|not) | select(.updatedAt >= \"${PR_SINCE:-1970}\") | \"\(.number) \(.headRefOid)\"" 2>/dev/null \
| while read -r num sha; do
    [ -z "$sha" ] && continue
    [ -f "$STATE/gated/$sha" ] && continue
    [ -f "$LCI_HOME/DISABLED" ] && [ "$DRY" != 1 ] && break
    git fetch -q origin "pull/$num/head" 2>/dev/null || { log "cannot fetch #$num"; continue; }
    if docs_only "$sha"; then
      post_status "$sha" success local-ci/gate "docs only — nothing to gate"
      [ "$DRY" = 1 ] || echo skip-docs > "$STATE/gated/$sha"
      continue
    fi
    run_gate "$sha" pr "#$num" </dev/null
    # main moves while PRs are gated; never let a PR queue starve a deploy
    git fetch -q origin main && [ "$(git rev-parse origin/main)" != "$MAIN_SHA" ] && { log "main moved — ending this tick"; break; }
  done
exit 0
