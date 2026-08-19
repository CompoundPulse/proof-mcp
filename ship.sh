#!/usr/bin/env bash
# ONE command to ship proof-mcp everywhere.
#
#     ./ship.sh 123456        <- your real 6-digit code from the authenticator
#
# Do not type XXXXXX. Type the six digits showing in your app right now.
# npm rejects anything that is not digits, which is what the last run hit.
#
# It republishes to npm, refreshes the registry token (the JWT is short-lived
# and had already expired between login and publish last time), and publishes
# to the official MCP Registry. Each step is checked before the next runs, so
# it stops on the first real failure instead of reporting success.

set -uo pipefail
cd "$(dirname "$0")" || exit 1

OTP="${1:-}"
PUB="/private/tmp/claude-501/-Users-papigringo-Desktop-my-asset-analyzer2/9c7fd851-da52-4ca3-81a8-18cc93ab4e55/scratchpad/pub/mcp-publisher"

if ! [[ "$OTP" =~ ^[0-9]{6}$ ]]; then
  echo "✗ Need your 6-digit authenticator code."
  echo "  Usage: ./ship.sh 123456"
  echo "  (six digits — not XXXXXX, not the recovery code)"
  exit 1
fi

VER=$(node -p "require('./package.json').version")
echo "── shipping proof-mcp v$VER"

# 1. npm ─────────────────────────────────────────────────────────────────────
echo "1/3  npm publish…"
if npm publish --access public --otp="$OTP" 2>&1 | tail -3; then :; fi
sleep 3
LIVE=$(curl -s "https://registry.npmjs.org/proof-mcp" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8'))['dist-tags'].latest" 2>/dev/null)
if [ "$LIVE" != "$VER" ]; then
  echo "✗ npm still shows $LIVE, expected $VER."
  echo "  If it said 'cannot publish over previously published version', bump the version and rerun."
  echo "  If it said the OTP was wrong, the code rotated — grab a fresh one and rerun."
  exit 1
fi
echo "  ✓ npm now serves $VER"

# 2. registry auth ───────────────────────────────────────────────────────────
# The JWT expires quickly, so always re-login immediately before publishing
# rather than reusing whatever is on disk.
echo "2/3  registry login…"
GH=$(gh auth token 2>/dev/null)
if [ -z "$GH" ]; then echo "✗ no GitHub token — run: gh auth login"; exit 1; fi
"$PUB" login github --token "$GH" >/dev/null 2>&1 || { echo "✗ registry login failed"; exit 1; }
echo "  ✓ authenticated"

# 3. registry publish ────────────────────────────────────────────────────────
echo "3/3  registry publish…"
OUT=$("$PUB" publish 2>&1)
echo "$OUT" | tail -4 | sed 's/^/  /'
if echo "$OUT" | grep -qi "error\|failed"; then
  echo "✗ registry publish failed — see above"
  exit 1
fi

echo
echo "✅ LIVE EVERYWHERE"
echo "   npm      https://www.npmjs.com/package/proof-mcp"
echo "   registry https://registry.modelcontextprotocol.io/v0/servers?search=proof-mcp"
echo "   github   https://github.com/CompoundPulse/proof-mcp"
