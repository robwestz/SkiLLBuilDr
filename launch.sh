#!/usr/bin/env bash
# ECC Browser launcher: rebuild data from the ECC plugin and open the UI in the default browser.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INVOKE_DIR="$(pwd)"
cd "$SCRIPT_DIR"

# Pass invoking dir as project so project-level .claude/{skills,commands} are included
if [[ -d "$INVOKE_DIR/.claude" && "$INVOKE_DIR" != "$SCRIPT_DIR" ]]; then
  node build.mjs --project "$INVOKE_DIR"
else
  node build.mjs
fi

TARGET="$SCRIPT_DIR/index.html"

if [[ -n "${WINDIR:-}" || -n "${SYSTEMROOT:-}" ]]; then
  WIN_PATH="$(cygpath -w "$TARGET" 2>/dev/null || echo "$TARGET")"
  cmd.exe //c start "" "$WIN_PATH"
elif [[ "$(uname -s 2>/dev/null)" == "Darwin" ]]; then
  open "$TARGET"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$TARGET"
else
  echo "No known 'open' command. Manually open: $TARGET"
fi

echo "Opened: $TARGET"
