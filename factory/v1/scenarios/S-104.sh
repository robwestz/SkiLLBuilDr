#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="S-104"
DESC="Leak scan rejects scenario identifiers and fixture fingerprints in builder-visible output while allowing clean artifacts."

cleanup() {
  [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]] && rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

scenario::init
TMP_DIR="$(mktemp -d)"

set +e
SAFE_OUT="$(bash "${ROOT_DIR}/tools/leak-scan.sh" "${ROOT_DIR}/fixtures/leak-safe" 2>&1)"
SAFE_RC=$?
LEAK_OUT="$(bash "${ROOT_DIR}/tools/leak-scan.sh" "${ROOT_DIR}/fixtures/leak-positive" 2>&1)"
LEAK_RC=$?
set -e

if [[ "${SAFE_RC}" -ne 0 ]]; then
  scenario::fail "leak_scan_false_positive" "clean fixture was rejected by leak-scan" "rerun via bash scenarios/runner.sh --scenario S-104" "${SAFE_OUT}"
fi

if [[ "${LEAK_RC}" -ne 1 ]]; then
  scenario::fail "leak_scan_false_negative" "leaky fixture was not rejected by leak-scan" "rerun via bash scenarios/runner.sh --scenario S-104" "${LEAK_OUT}"
fi

if [[ "${LEAK_OUT}" != *"S-101"* || "${LEAK_OUT}" != *"FX-HOLDOUT-ALPHA-94721"* ]]; then
  scenario::fail "leak_scan_evidence_missing" "leak-scan output did not identify the seeded leak markers" "rerun via bash scenarios/runner.sh --scenario S-104" "${LEAK_OUT}"
fi

scenario::pass "leak-scan accepted clean output and rejected seeded holdout markers"
