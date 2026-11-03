#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/Library/Application Support/HANDS for GPT/Beat Finder"
LAUNCHER="$HOME/Applications/HANDS Beat Finder.command"
if ! command -v node >/dev/null 2>&1; then echo "Node.js 20+ required. Install Node before running Beat Finder." >&2; exit 1; fi
if ! command -v ffmpeg >/dev/null 2>&1; then echo "FFmpeg required. Install FFmpeg (e.g. brew install ffmpeg) before running Beat Finder." >&2; exit 1; fi
mkdir -p "$TARGET/public" "$HOME/Applications"
chmod 700 "$TARGET"
cp "$ROOT/server.mjs" "$TARGET/server.mjs"
cp "$ROOT/music.mjs" "$TARGET/music.mjs"
cp "$ROOT/public/index.html" "$TARGET/public/index.html"
cp "$ROOT/launch.command" "$TARGET/launch.command"
chmod 700 "$TARGET/launch.command"
cat > "$LAUNCHER" <<'SCRIPT'
#!/bin/bash
exec bash "$HOME/Library/Application Support/HANDS for GPT/Beat Finder/launch.command"
SCRIPT
chmod 700 "$LAUNCHER"
echo "Beat Finder runtime installed in: $TARGET"
echo "Launch with: $LAUNCHER"
echo "Local beat catalog is stored separately and is not overwritten by runtime updates."
