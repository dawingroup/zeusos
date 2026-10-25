#!/bin/bash
# scripts/local-ci/ctl.sh — install and control the local CI agent (agent.sh).
#
#   bash scripts/local-ci/ctl.sh install     clone, pin the scripts, seed state, start launchd
#   bash scripts/local-ci/ctl.sh status      is it loaded, what did it last do, what is deployed
#   bash scripts/local-ci/ctl.sh run         one tick in the foreground (LOCAL_CI_DRY_RUN=1 to rehearse)
#   bash scripts/local-ci/ctl.sh disable     stop acting (flag file; launchd keeps ticking, harmlessly)
#   bash scripts/local-ci/ctl.sh enable
#   bash scripts/local-ci/ctl.sh retry       forget failed deploys + failed gates so the next tick redoes them
#   bash scripts/local-ci/ctl.sh retry deploy  forget ONLY the failed deploy of the current tip of main
#   bash scripts/local-ci/ctl.sh update      re-pin agent.sh / ci-gate.sh from THIS checkout
#   bash scripts/local-ci/ctl.sh uninstall   unload launchd (keeps ~/.zeusos-local-ci for the record)
#
# Install env: DEPLOYED_SHA (the main commit whose hosting + functions are live
# right now; default: origin/main — i.e. "everything is deployed"), PR_SINCE
# (ISO time; only PRs updated since are gated; default 48h ago), PR_MODE
# (full|fast), DEPLOY (1|0), DEPLOY_WHEN_ACTIONS_ALIVE (1|0, default 1 — the
# deploy workflows have no working token), INTERVAL seconds (default 180).
set -euo pipefail

LCI_HOME="${LOCAL_CI_HOME:-$HOME/.zeusos-local-ci}"
LABEL="group.zeus.local-ci"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_ROOT="$(cd "$HERE/../.." && pwd)"
REPO="${REPO:-dawingroup/zeusos}"
CANONICAL="${CANONICAL:-/Users/danielonzimai/Developer/zeusos}"
export PATH="/opt/homebrew/bin:$PATH"

pin() {
  mkdir -p "$LCI_HOME/bin"
  cp "$HERE/agent.sh" "$SRC_ROOT/scripts/ci-gate.sh" "$LCI_HOME/bin/"
  chmod +x "$LCI_HOME/bin/"*.sh
  git -C "$SRC_ROOT" rev-parse HEAD > "$LCI_HOME/bin/PINNED_FROM"
  echo "pinned agent.sh + ci-gate.sh from $(cut -c1-9 "$LCI_HOME/bin/PINNED_FROM") ($SRC_ROOT)"
}

case "${1:-status}" in
  install)
    command -v gh >/dev/null && gh auth status >/dev/null 2>&1 || { echo "gh must be installed and logged in" >&2; exit 1; }
    [ -f "$CANONICAL/.env" ] || { echo "no $CANONICAL/.env — set CANONICAL=<the deploy checkout>" >&2; exit 1; }
    mkdir -p "$LCI_HOME/state/gated" "$LCI_HOME/state/deploy-failed" "$LCI_HOME/logs"
    if [ ! -d "$LCI_HOME/repo/.git" ]; then
      echo "→ cloning $REPO (objects borrowed from $CANONICAL, then dissociated)"
      git clone -q --reference "$CANONICAL" --dissociate "https://github.com/$REPO.git" "$LCI_HOME/repo"
    fi
    git -C "$LCI_HOME/repo" fetch -q origin main
    pin
    if [ ! -f "$LCI_HOME/config" ]; then
      cat > "$LCI_HOME/config" <<CFG
# local CI agent — sourced by bin/agent.sh every tick; edit freely.
REPO="$REPO"
CANONICAL="$CANONICAL"          # where .env and the shared deploy lock live
PR_SINCE="${PR_SINCE:-$(date -u -v-48H '+%Y-%m-%dT%H:%M:%SZ')}"   # PRs not updated since are left alone
PR_MODE="${PR_MODE:-full}"       # full | fast (fast = no emulator suite, no build)
DEPLOY="${DEPLOY:-1}"            # 0 = gate only, never deploy
DEPLOY_WHEN_ACTIONS_ALIVE="${DEPLOY_WHEN_ACTIONS_ALIVE:-1}"   # 0 = stand down entirely while GitHub Actions runs jobs
HOSTING_URL="https://zeusos.web.app/"   # where the hosting deploy is proved by content
CFG
      echo "wrote $LCI_HOME/config"
    fi
    # Seed: what is live NOW, so the first tick does not redeploy the world.
    SEED="${DEPLOYED_SHA:-$(git -C "$LCI_HOME/repo" rev-parse origin/main)}"
    SEED="$(git -C "$LCI_HOME/repo" rev-parse "$SEED")"
    for k in deployed-hosting deployed-functions deployed-infra; do
      [ -f "$LCI_HOME/state/$k" ] || echo "$SEED" > "$LCI_HOME/state/$k"
    done
    echo "deploy base: $(cut -c1-9 "$LCI_HOME/state/deployed-functions") (functions) / $(cut -c1-9 "$LCI_HOME/state/deployed-hosting") (hosting)"
    cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$LCI_HOME/bin/agent.sh</string></array>
  <key>StartInterval</key><integer>${INTERVAL:-180}</integer>
  <key>RunAtLoad</key><true/>
  <!-- NO ProcessType=Background / Nice / LowPriorityIO: they make every gate
       step ~4x slower, which pushes unit tests past their timeout — a false red. -->
  <key>EnvironmentVariables</key><dict>
    <key>HOME</key><string>$HOME</string>
    <key>LOCAL_CI_HOME</key><string>$LCI_HOME</string>
  </dict>
  <key>StandardOutPath</key><string>$LCI_HOME/logs/agent.log</string>
  <key>StandardErrorPath</key><string>$LCI_HOME/logs/agent.log</string>
</dict></plist>
PL
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "loaded $LABEL (every ${INTERVAL:-180}s). Log: $LCI_HOME/logs/agent.log"
    ;;
  update) pin ;;
  run) exec /bin/bash "$LCI_HOME/bin/agent.sh" ;;
  disable) touch "$LCI_HOME/DISABLED"; echo "disabled — a gate or deploy already running finishes; nothing new starts" ;;
  enable) rm -f "$LCI_HOME/DISABLED"; echo "enabled" ;;
  retry)
    case "${2:-all}" in
      deploy)
        git -C "$LCI_HOME/repo" fetch -q origin main || { echo "cannot fetch origin/main in $LCI_HOME/repo" >&2; exit 1; }
        tip="$(git -C "$LCI_HOME/repo" rev-parse origin/main)"
        if [ -f "$LCI_HOME/state/deploy-failed/$tip" ]; then
          rm -f "$LCI_HOME/state/deploy-failed/$tip"
          echo "forgot the failed deploy of ${tip:0:9} (the tip of main) — the next tick redeploys it; gates untouched"
        else
          echo "no failed deploy recorded for ${tip:0:9} (the tip of main); nothing to forget"
          other="$(ls "$LCI_HOME/state/deploy-failed" 2>/dev/null | cut -c1-9 | paste -sd' ' -)"
          [ -n "$other" ] && echo "older failed deploys on record (never redeployed — the tip supersedes them): $other"
        fi ;;
      all)
        rm -f "$LCI_HOME/state/deploy-failed/"* 2>/dev/null || true
        grep -lE '^(fail|error)' "$LCI_HOME/state/gated/"* 2>/dev/null | xargs rm -f 2>/dev/null || true
        echo "failed gates and failed deploys forgotten — the next tick redoes them" ;;
      *) echo "usage: ctl.sh retry [deploy]" >&2; exit 2 ;;
    esac ;;
  uninstall)
    launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"; echo "unloaded. State and logs kept in $LCI_HOME" ;;
  status)
    if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then echo "launchd: loaded"; else echo "launchd: NOT loaded"; fi
    [ -f "$LCI_HOME/DISABLED" ] && echo "agent:   DISABLED (flag file)" || echo "agent:   enabled"
    [ -f "$LCI_HOME/state/stood-down" ] && echo "         STOOD DOWN — GitHub Actions is running again and DEPLOY_WHEN_ACTIONS_ALIVE=0"
    [ -d "$LCI_HOME/agent.lock" ] && echo "running: pid $(cat "$LCI_HOME/agent.lock/pid" 2>/dev/null)"
    echo "pinned:  $(cut -c1-9 "$LCI_HOME/bin/PINNED_FROM" 2>/dev/null || echo '?')"
    for k in deployed-infra deployed-functions deployed-hosting; do printf '%-18s %s\n' "$k:" "$(cut -c1-9 "$LCI_HOME/state/$k" 2>/dev/null || echo '-')"; done
    failed_deploys="$(ls "$LCI_HOME/state/deploy-failed" 2>/dev/null | cut -c1-9 | paste -sd' ' -)"
    [ -n "$failed_deploys" ] && echo "deploy-failed:     $failed_deploys  (ctl.sh retry deploy clears the tip's)"
    echo "gated:   $(ls "$LCI_HOME/state/gated" 2>/dev/null | wc -l | tr -d ' ') commits ($(grep -l '^pass' "$LCI_HOME/state/gated/"* 2>/dev/null | wc -l | tr -d ' ') pass, $(grep -lE '^(fail|error)' "$LCI_HOME/state/gated/"* 2>/dev/null | wc -l | tr -d ' ') fail)"
    echo "--- last agent log lines"; tail -n 12 "$LCI_HOME/logs/agent.log" 2>/dev/null || echo "(none yet)"
    echo "--- last deploys"; tail -n 5 "$LCI_HOME/deploys.log" 2>/dev/null || echo "(none yet)"
    ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
