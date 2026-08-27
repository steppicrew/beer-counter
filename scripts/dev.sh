#!/usr/bin/env bash
# Start the Vite dev server, reachable from your phone on the same network.
#
#   ./scripts/dev.sh            # default port 5173
#   ./scripts/dev.sh 3000       # custom port
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${1:-5173}"

# The system node may be too old for Vite 7; prefer an fnm-managed 22+.
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 >/dev/null 2>&1 || true
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node 20+ required (found $(node --version))." >&2
  exit 1
fi

if [ ! -d .yarn/cache ] && [ ! -f .pnp.cjs ]; then
  echo "Installing dependencies…"
  yarn install
fi

# Print the LAN URL so the PWA can be opened on a phone for real tap-testing.
LAN_IP="$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)"
echo
echo "  Local:   http://localhost:${PORT}/"
[ -n "$LAN_IP" ] && echo "  Network: http://${LAN_IP}:${PORT}/"
echo

exec yarn vite --host 0.0.0.0 --port "$PORT" --strictPort
