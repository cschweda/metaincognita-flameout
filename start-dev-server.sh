#!/usr/bin/env bash
# Restart the Nuxt dev server: kill anything already on the dev port (plus any
# stray dev server from this project on another port), then start fresh.
#
# Usage:
#   ./start-dev-server.sh           # default port 3000
#   PORT=3001 ./start-dev-server.sh # custom port

set -euo pipefail

PORT="${PORT:-3000}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ── Kill whatever is listening on the dev port ──────────────────────────────
pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
if [ -n "$pids" ]; then
  echo "▸ Stopping process(es) on port $PORT: $(echo "$pids" | tr '\n' ' ')"
  echo "$pids" | xargs kill 2>/dev/null || true
fi

# ── Kill stray dev servers from THIS project (e.g. started on another port) ──
# Matches the nuxi binary path under this project only, so dev servers of
# other projects are left alone.
stray="$(pgrep -f "$PROJECT_DIR/node_modules/.*nux.*dev" 2>/dev/null || true)"
if [ -n "$stray" ]; then
  echo "▸ Stopping stray dev server(s) from this project: $(echo "$stray" | tr '\n' ' ')"
  echo "$stray" | xargs kill 2>/dev/null || true
fi

# ── Give them a moment to exit, then force-kill any holdout on the port ─────
if [ -n "$pids$stray" ]; then
  sleep 1
  leftover="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$leftover" ]; then
    echo "▸ Force-killing stubborn process(es): $(echo "$leftover" | tr '\n' ' ')"
    echo "$leftover" | xargs kill -9 2>/dev/null || true
  fi
fi

# ── Start fresh ──────────────────────────────────────────────────────────────
echo "▸ Starting dev server on http://localhost:$PORT"
exec pnpm dev --port "$PORT"
