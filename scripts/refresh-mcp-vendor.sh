#!/usr/bin/env bash
#
# Regenerate the committed MCP vendor bundle from a CLEAN build of its source.
#
#   bash scripts/refresh-mcp-vendor.sh        # after any zeusos-mcp-server/src change
#   bash scripts/refresh-mcp-vendor.sh --ci   # same, `npm ci` first (firebase.json predeploy)
#
# then commit functions/vendor/zeusos-mcp-server/ with your src change.
# `npm run check:mcp-vendor` proves the result.
#
# WHY A SCRIPT, AND WHY BOTH `rm -rf`s
# The old recipe was `npm run build && cp -r dist/* <vendor>/`, and both halves
# only ever ADD files:
#   - `tsc` never deletes outputs. Build branch A (which adds src/lib/x.ts),
#     switch the same worktree to branch B (which does not), build again, and
#     dist/lib/x.js from branch A is still there.
#   - `cp -r` never deletes either, so a module removed from src kept its
#     .js/.d.ts/.map in the vendor tree forever.
# On 2026-09-13 that copied 8 stray lib/materialRateHistory* files into the
# bundle from another branch's build, and check-mcp-vendor-fresh.sh reported a
# match (139 .js files, not 137) because the same strays sat on BOTH sides of
# its diff. So dist is cleared before building, and the vendor tree is
# REPLACED rather than copied over.
#
# Replacing it wholesale is safe because the vendor tree holds nothing but tsc
# output plus package.json — check-mcp-vendor-fresh.sh fails on any other file
# in it — so there is nothing hand-maintained to preserve.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="$ROOT/zeusos-mcp-server"
VENDOR="$ROOT/functions/vendor/zeusos-mcp-server"

case "${1:-}" in
  "") ;;
  --ci) ( cd "$PKG" && npm ci --prefer-offline ) ;;
  *) echo "usage: $0 [--ci]" >&2; exit 2 ;;
esac

[ -d "$PKG/node_modules" ] || {
  echo "✗ zeusos-mcp-server/node_modules is empty — run 'cd zeusos-mcp-server && npm ci' first (or pass --ci)" >&2
  exit 1
}

rm -rf "$PKG/dist"
( cd "$PKG" && npm run build )

# Only reached when the build succeeded (set -e), so a broken build never
# leaves the committed bundle half-deleted.
rm -rf "${VENDOR:?}"
mkdir -p "$VENDOR"
cp -R "$PKG/dist/." "$VENDOR/"
cp "$PKG/package.json" "$VENDOR/package.json"

files="$(find "$VENDOR" -name '*.js' | wc -l | tr -d ' ')"
echo "✓ functions/vendor/zeusos-mcp-server rebuilt from a clean build ($files .js files)"
