#!/usr/bin/env bash
#
# The committed MCP vendor bundle must match a fresh build of its source.
#
# WHY THIS EXISTS
# `firebase deploy --only functions:dawinos_mcp` ships whatever sits in
# functions/vendor/zeusos-mcp-server/ — a CHECKED-IN tsc artifact. The
# TypeScript in zeusos-mcp-server/src is never compiled at deploy time by the
# function itself; firebase.json's predeploy hook rebuilds and copies it, but
# only on deploys that actually run that hook. So a PR that edits
# zeusos-mcp-server/src and forgets the rebuild looks complete, reviews clean,
# merges green — and changes NOTHING in production. The symptom is silence,
# which is the worst kind.
#
# A per-feature test cannot cover this: the staleness rule is package-wide
# while any one test pins one file. This compares the whole tree.
#
# Run it yourself before pushing an MCP change:
#   bash scripts/check-mcp-vendor-fresh.sh
#
# To FIX a failure, regenerate the bundle exactly as firebase.json's predeploy
# does:
#   bash scripts/refresh-mcp-vendor.sh
# then commit functions/vendor/zeusos-mcp-server/ alongside your src change.
#
# The comparison is always against a CLEAN build: `tsc` never deletes outputs,
# so a dist/ left over from building another branch in this worktree carries
# that branch's extra modules. The old refresh recipe (`build && cp -r dist/*`)
# copied them into the bundle, and this check then passed LOCALLY because the
# same strays sat on both sides of the diff (2026-09-13: 139 .js files where a
# clean build has 137). CI never saw it — a fresh checkout has no dist/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/zeusos-mcp-server"
VENDOR="$ROOT/functions/vendor/zeusos-mcp-server"

[ -d "$PKG" ] || { echo "✗ $PKG not found"; exit 1; }
[ -d "$PKG/node_modules" ] || {
  echo "✗ zeusos-mcp-server/node_modules is empty — run 'cd zeusos-mcp-server && npm ci' first"
  exit 1
}

echo "→ building zeusos-mcp-server from source (clean dist/)…"
rm -rf "$PKG/dist"
( cd "$PKG" && npm run build >/dev/null )

# ZeusOS does NOT commit the vendor bundle (.gitignore: functions/vendor/
# zeusos-mcp-server/) — firebase.json's functions predeploy rebuilds it with
# refresh-mcp-vendor.sh on every deploy. So with no vendor tree present, the
# check is "the MCP server builds cleanly from a clean dist/", and that just
# passed. When a tree IS present (a local deploy left one), it must match.
if [ ! -d "$VENDOR" ]; then
  files="$(find "$PKG/dist" -name '*.js' | wc -l | tr -d ' ')"
  echo "✓ zeusos-mcp-server builds from a clean dist/ ($files .js files); no vendor bundle to compare (built at deploy)"
  exit 0
fi

# `dist` and the vendor dir are compared verbatim because the refresh copy IS
# verbatim (refresh-mcp-vendor.sh) — including .js.map files, whose relative
# source paths therefore match. package.json is copied separately from the package
# ROOT, not from dist, so it is compared on its own below rather than excluded
# by name (a name-based exclude would also hide a nested one, should tsc ever
# emit one; there are none today).
#
# Do NOT pipe this diff into a filter that swallows its status — the guard must
# key off the CONTENT, not a pipeline exit code that reports the last command.
drift="$(diff -r "$PKG/dist" "$VENDOR" 2>&1 | grep -v '^Only in .*: package\.json$' || true)"

# On GitHub Actions, prefix failures so they surface as PR annotations rather
# than only in the raw log.
err() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::error::$1"; else echo "$1"; fi; }

if [ -n "$drift" ]; then
  echo
  err "✗ functions/vendor/zeusos-mcp-server is STALE — it does not match a fresh build."
  err "  Production runs the vendored bundle, so this change would ship nothing."
  echo
  echo "$drift"
  echo
  err "  Fix:  bash scripts/refresh-mcp-vendor.sh"
  err "  Then commit functions/vendor/zeusos-mcp-server/ with your src change."
  err "  (It REPLACES the vendor tree from a clean build, so 'Only in …vendor'"
  err "  files from a module deleted from src go too — do not cp -r over it.)"
  exit 1
fi

if ! cmp -s "$PKG/package.json" "$VENDOR/package.json"; then
  err "✗ functions/vendor/zeusos-mcp-server/package.json differs from the package root."
  err "  Fix:  bash scripts/refresh-mcp-vendor.sh"
  exit 1
fi

files="$(find "$VENDOR" -name '*.js' | wc -l | tr -d ' ')"
echo "✓ vendor bundle matches a fresh build ($files .js files)"
