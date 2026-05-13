#!/usr/bin/env bash
# install-example.sh — appends a cron line for a routine.
# Prints the line first and asks before writing, so you can copy to launchd / systemd instead.
#
# Usage:
#   ./cron/install-example.sh <routine.json> "<cron-expr>"
# Example:
#   ./cron/install-example.sh ../routines/code-review.routine.json "0 7 * * 1-5"

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <routine.json> \"<cron-expr>\"" >&2
  echo "Example: $0 ../routines/code-review.routine.json \"0 7 * * 1-5\"" >&2
  exit 1
fi

routine_path="$1"
cron_expr="$2"

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
runner="$repo_root/routine-run.mjs"

if [[ ! -f "$runner" ]]; then
  echo "routine-run.mjs not found at $runner — did you move the cron/ folder?" >&2
  exit 2
fi

routine_abs="$(cd "$(dirname "$routine_path")" && pwd)/$(basename "$routine_path")"
if [[ ! -f "$routine_abs" ]]; then
  echo "Routine not found at $routine_path" >&2
  exit 2
fi

# Prefer the system node; fall back to current PATH.
node_bin="$(command -v node || true)"
if [[ -z "$node_bin" ]]; then
  echo "node not on PATH — install Node.js >= 18 or set NODE_BIN env var." >&2
  exit 3
fi

cron_line="$cron_expr $node_bin $runner $routine_abs --execute >> $repo_root/.agents/cron-stdout.log 2>&1"

echo "Proposed crontab line:"
echo
echo "  $cron_line"
echo
read -r -p "Append this line to the current user's crontab? (y/N) " yn
case "$yn" in
  y|Y) ;;
  *) echo "Aborted; no changes made."; exit 1;;
esac

# Append while preserving existing entries.
( crontab -l 2>/dev/null || true; echo "$cron_line" ) | crontab -

echo "Cron entry installed. Inspect via: crontab -l"
echo "Remove via:                       crontab -e   (delete the matching line)"
