#!/usr/bin/env bash
# Ship proof-mcp to npm + the official MCP Registry.
#
#     ./ship.sh
#
# No arguments. No 6-digit code — this account uses a WebAuthn passkey, so npm
# opens a browser and you tap it. (An earlier version of this script asked for
# an OTP; that was wrong for this account and produced the
# '"otp" fails to match /^\d+$/' error.)
#
# The npm CLI session expires quietly. When it does, npm answers a publish with
# 404 "not found or you do not have permission" rather than a clear 401, which
# reads like the package is missing when it is really just auth. This checks
# first and says so plainly.

set -uo pipefail
cd "$(dirname "$0")" || exit 1

PUB="/private/tmp/claude-501/-Users-papigringo-Desktop-my-asset-analyzer2/9c7fd851-da52-4ca3-81a8-18cc93ab4e55/scratchpad/pub/mcp-publisher"
VER=$(node -p "require('./package.json').version")
echo "── proof-mcp v$VER"

# 0. auth ────────────────────────────────────────────────────────────────────
if ! npm whoami >/dev/null 2>&1; then
  echo
  echo "  Your npm session has expired. Run this, tap your passkey in the browser,"
  echo "  then run ./ship.sh again:"
  echo
  echo "      npm login"
  echo
  exit 1
fi
echo "  ✓ npm: $(npm whoami 2>/dev/null)"

# 1. npm ─────────────────────────────────────────────────────────────────────
LIVE=$(npm view proof-mcp version 2>/dev/null)
if [ "$LIVE" = "$VER" ]; then
  echo "  ✓ npm already serves $VER — skipping publish"
else
  echo "1/3  npm publish $LIVE -> $VER…"
  npm publish --access public 2>&1 | tail -3 | sed 's/^/     /'
  sleep 3
  LIVE=$(npm view proof-mcp version 2>/dev/null)
  [ "$LIVE" = "$VER" ] || { echo "  ✗ npm still at $LIVE — see the error above"; exit 1; }
  echo "  ✓ npm now serves $VER"
fi

# 2. registry auth ───────────────────────────────────────────────────────────
# The registry JWT is short-lived, so always re-login right before publishing
# instead of trusting whatever is cached on disk.
echo "2/3  registry login…"
GH=$(gh auth token 2>/dev/null)
[ -n "$GH" ] || { echo "  ✗ no GitHub token — run: gh auth login"; exit 1; }
"$PUB" login github --token "$GH" >/dev/null 2>&1 || { echo "  ✗ registry login failed"; exit 1; }
echo "  ✓ authenticated"

# 3. registry publish ────────────────────────────────────────────────────────
echo "3/3  registry publish…"
OUT=$("$PUB" publish 2>&1)
echo "$OUT" | tail -4 | sed 's/^/     /'
echo "$OUT" | grep -qi "error\|failed" && { echo "  ✗ registry publish failed"; exit 1; }

echo
echo "✅ LIVE"
echo "   npm      https://www.npmjs.com/package/proof-mcp"
echo "   registry https://registry.modelcontextprotocol.io/v0/servers?search=proof-mcp"
