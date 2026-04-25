#!/usr/bin/env bash
# demo-autonomous-loop.sh — orchestrate one end-to-end pass of the autonomous
# agent flow on a trivial goal. Used to verify that:
#
#   1. assemble.mjs --auto-onboard --auto-phase0 --chunk-plan produces a
#      KICKOFF with the operator's pre-filled Phase 0 contract baked in.
#   2. The generated ZIP is self-contained (frameworks/* + KICKOFF + CLAUDE
#      + README) and extracts cleanly into a sandbox.
#   3. An executing agent can be invoked against the sandbox (manually for
#      now — Robin reads the printed instructions and runs `claude` himself,
#      or passes --auto-execute to attempt direct invocation).
#
# This is a harness, not a full autonomy stack. The agent execution step is
# still operator-triggered. The script's job is to make that one command
# trivial to run and the artifacts trivial to inspect.
#
# Usage:
#   ./demo-autonomous-loop.sh                          # default trivial goal
#   ./demo-autonomous-loop.sh --goal "your goal"       # custom goal
#   ./demo-autonomous-loop.sh --auto-execute           # try to spawn agent
#   ./demo-autonomous-loop.sh --keep                   # keep prior out dir

set -euo pipefail

# ---------- args ----------
GOAL="Add a one-line greeting to the project README and commit locally."
OUT_DIR="out/demo-loop"
AUTO_EXECUTE=0
KEEP=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --goal) GOAL="$2"; shift 2 ;;
    --out)  OUT_DIR="$2"; shift 2 ;;
    --auto-execute) AUTO_EXECUTE=1; shift ;;
    --keep) KEEP=1; shift ;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

PHASE0_FIXTURE="demo/phase0.json"
CHUNK_FIXTURE="demo/chunks.json"

# ---------- preflight ----------
for f in "$PHASE0_FIXTURE" "$CHUNK_FIXTURE" assemble.mjs; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: missing required file $f" >&2
    exit 1
  fi
done

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not on PATH" >&2
  exit 1
fi

# ---------- prepare workspace ----------
if [[ -d "$OUT_DIR" && $KEEP -eq 0 ]]; then
  echo "→ clearing prior $OUT_DIR (use --keep to preserve)"
  rm -rf "$OUT_DIR"
fi
mkdir -p "$OUT_DIR"

# Inject the current ISO-8601 timestamp into a copy of phase0.json so the
# Phase 0 signature line is timestamped at run time, not at fixture-edit time.
ISO_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PHASE0_TMP="$OUT_DIR/.phase0.json"
sed "s|__SCRIPT_FILLS_THIS__|$ISO_TS|" "$PHASE0_FIXTURE" > "$PHASE0_TMP"

# ---------- assemble ----------
echo
echo "═══════════════════════════════════════════════════════════════════"
echo " STEP 1 / 4  —  ASSEMBLE PACKAGE"
echo "═══════════════════════════════════════════════════════════════════"
echo " goal:        $GOAL"
echo " out:         $OUT_DIR"
echo " auto-onboard: yes"
echo " phase0:       $PHASE0_FIXTURE  (ts=$ISO_TS)"
echo " chunks:       $CHUNK_FIXTURE"
echo

node assemble.mjs \
  --goal "$GOAL" \
  --tier mvp \
  --limit 6 \
  --auto \
  --auto-onboard \
  --auto-phase0 "$PHASE0_TMP" \
  --chunk-plan "$CHUNK_FIXTURE" \
  --out "$OUT_DIR"

# Find the produced ZIP — assemble.mjs writes one under $OUT_DIR.
ZIP_PATH="$(ls -t "$OUT_DIR"/*.zip 2>/dev/null | head -1 || true)"
if [[ -z "$ZIP_PATH" ]]; then
  echo "ERROR: assemble.mjs did not produce a ZIP under $OUT_DIR" >&2
  exit 1
fi
echo
echo "✓ package zipped at: $ZIP_PATH"

# ---------- extract sandbox ----------
echo
echo "═══════════════════════════════════════════════════════════════════"
echo " STEP 2 / 4  —  EXTRACT SANDBOX"
echo "═══════════════════════════════════════════════════════════════════"

SANDBOX="$OUT_DIR/sandbox"
rm -rf "$SANDBOX"
mkdir -p "$SANDBOX"

# Use Node's built-in for cross-platform unzip (no external `unzip` dep).
# zip-builder.mjs writes store-only entries (method=0); fall back to
# inflateRaw for the deflate case just in case future entries are compressed.
node -e "
  import('node:fs').then(async ({ default: fs }) => {
    const path = (await import('node:path')).default;
    const zlib = (await import('node:zlib')).default;
    const buf = fs.readFileSync(process.argv[1]);
    const eocd = buf.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
    if (eocd < 0) { console.error('no EOCD'); process.exit(1); }
    const cdSize = buf.readUInt32LE(eocd + 12);
    const cdOff  = buf.readUInt32LE(eocd + 16);
    let p = cdOff, end = cdOff + cdSize;
    while (p < end) {
      const sig = buf.readUInt32LE(p);
      if (sig !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10);
      const cSize  = buf.readUInt32LE(p + 20);
      const nLen   = buf.readUInt16LE(p + 28);
      const xLen   = buf.readUInt16LE(p + 30);
      const cLen   = buf.readUInt16LE(p + 32);
      const lhOff  = buf.readUInt32LE(p + 42);
      const name   = buf.slice(p + 46, p + 46 + nLen).toString('utf8');
      const ln  = buf.readUInt16LE(lhOff + 26);
      const lx  = buf.readUInt16LE(lhOff + 28);
      const dStart = lhOff + 30 + ln + lx;
      const data   = buf.slice(dStart, dStart + cSize);
      const decoded = method === 0 ? data : zlib.inflateRawSync(data);
      const dest = path.join(process.argv[2], name);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (!name.endsWith('/')) fs.writeFileSync(dest, decoded);
      p += 46 + nLen + xLen + cLen;
    }
  });
" "$ZIP_PATH" "$SANDBOX"

echo "✓ extracted into: $SANDBOX"
echo
echo "Contents:"
( cd "$SANDBOX" && find . -maxdepth 2 -type f | sort | sed 's|^\./|  |' )

# ---------- inspect KICKOFF ----------
echo
echo "═══════════════════════════════════════════════════════════════════"
echo " STEP 3 / 4  —  KICKOFF PREVIEW (first 60 lines)"
echo "═══════════════════════════════════════════════════════════════════"

KICKOFF="$(find "$SANDBOX" -maxdepth 3 -name KICKOFF.md | head -1)"
if [[ -z "$KICKOFF" ]]; then
  echo "ERROR: no KICKOFF.md inside extracted package" >&2
  exit 1
fi
sed -n '1,60p' "$KICKOFF"

# Sanity-check that the prefill landed.
MISSING=()
grep -q "Pre-onboarding (operator-confirmed)" "$KICKOFF" || MISSING+=("auto-onboard banner")
grep -q "operator (demo-autonomous-loop.sh)"  "$KICKOFF" || MISSING+=("phase0 signedBy")
grep -q "Draft and insert greeting line"      "$KICKOFF" || MISSING+=("chunk plan C1")
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo
  echo "⚠ KICKOFF is missing expected prefill markers:"
  printf '   - %s\n' "${MISSING[@]}"
  exit 1
fi

# ---------- agent invocation ----------
echo
echo "═══════════════════════════════════════════════════════════════════"
echo " STEP 4 / 4  —  AGENT INVOCATION"
echo "═══════════════════════════════════════════════════════════════════"
HANDOFF="$OUT_DIR/HANDOFF.md"
{
  echo "# Demo autonomous loop — handoff"
  echo
  echo "- timestamp: $ISO_TS"
  echo "- goal:      $GOAL"
  echo "- sandbox:   $SANDBOX"
  echo "- kickoff:   $KICKOFF"
  echo "- zip:       $ZIP_PATH"
  echo
  echo "## Next step"
  echo
  echo 'Open a fresh Claude Code session in the sandbox and feed it the KICKOFF:'
  echo
  echo '```bash'
  echo "cd $SANDBOX"
  echo 'claude < KICKOFF.md'
  echo '```'
  echo
  echo 'The executing agent should:'
  echo '  1. Re-sign Phase 0 (Section 0.6) confirming it accepts the prefill.'
  echo '  2. Execute C1 then C2 with EVAL LOOP between chunks.'
  echo '  3. Commit locally on a feature branch (no push).'
  echo '  4. Append its session summary to this HANDOFF.md.'
} > "$HANDOFF"

echo "✓ handoff written: $HANDOFF"
echo
cat "$HANDOFF"

if [[ $AUTO_EXECUTE -eq 1 ]]; then
  if command -v claude >/dev/null 2>&1; then
    echo
    echo "→ --auto-execute: spawning claude in $SANDBOX"
    ( cd "$SANDBOX" && claude < KICKOFF.md ) || {
      echo "claude exited non-zero (non-fatal for the demo)" >&2
    }
  else
    echo "⚠ --auto-execute requested but 'claude' not on PATH; skipping spawn"
  fi
fi

echo
echo "═══════════════════════════════════════════════════════════════════"
echo " DONE — autonomous-loop demo set up at $OUT_DIR"
echo "═══════════════════════════════════════════════════════════════════"
