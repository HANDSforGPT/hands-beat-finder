#!/bin/bash
set -euo pipefail
DIR="$HOME/Library/Application Support/HANDS for GPT/Beat Finder"
PORT=58983
URL="http://127.0.0.1:$PORT"
HEALTH="$(curl -fsS --max-time 2 "$URL/api/health" 2>/dev/null || true)"
if [[ "$HEALTH" != *'"ok":true'* ]]; then
  mkdir -p "$HOME/Library/Application Support/HANDS Beat Finder"
  nohup node "$DIR/server.mjs" >> "$HOME/Library/Application Support/HANDS Beat Finder/server.log" 2>&1 < /dev/null &
  sleep 1
  HEALTH="$(curl -fsS --max-time 3 "$URL/api/health" 2>/dev/null || true)"
  if [[ "$HEALTH" != *'"ok":true'* ]]; then
    echo "Beat Finder could not start. See ~/Library/Application Support/HANDS Beat Finder/server.log" >&2
    exit 1
  fi
fi
echo "Beat Finder is ready at $URL"
if command -v open >/dev/null 2>&1; then open "$URL"; fi
