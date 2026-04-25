#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATTERN_FILE="${SCRIPT_DIR}/leak-denylist.txt"

usage() {
  cat <<'EOF'
Usage: bash tools/leak-scan.sh <path> [<path> ...]

Scans builder-visible files for forbidden scenario identifiers and fixture fingerprints.
Exit 0 when clean, 1 when a leak is found, 2 on invalid usage.
EOF
}

if [[ $# -lt 1 ]]; then
  usage >&2
  exit 2
fi

TMP_REPORT="$(mktemp)"
cleanup() {
  [[ -f "${TMP_REPORT}" ]] && rm -f "${TMP_REPORT}"
}
trap cleanup EXIT

found=0
while IFS= read -r pattern; do
  [[ -z "${pattern}" || "${pattern}" == \#* ]] && continue
  for target in "$@"; do
    if grep -R -n -F --binary-files=without-match --exclude-dir=.git --exclude-dir=artifacts -- "${pattern}" "${target}" >>"${TMP_REPORT}" 2>/dev/null; then
      found=1
    fi
  done
done < "${PATTERN_FILE}"

if [[ "${found}" -eq 1 ]]; then
  echo "LEAK DETECTED"
  cat "${TMP_REPORT}"
  exit 1
fi

echo "OK leak-scan"
