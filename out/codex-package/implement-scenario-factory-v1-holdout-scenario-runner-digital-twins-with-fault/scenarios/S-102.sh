#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="S-102"
DESC="Rate-limit twin mode returns deterministic 429 classification without leaking assert details to builder feedback."

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  [[ -n "${TMP_DIR:-}" && -d "${TMP_DIR:-}" ]] && rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

scenario::init
TMP_DIR="$(mktemp -d)"
SEED="20202"
PORT="$(scenario::choose_port)"
TWIN_ARTIFACT_DIR="${ARTIFACT_DIR}/twin"
mkdir -p "${TWIN_ARTIFACT_DIR}"

"${FACTORY_PYTHON}" "${ROOT_DIR}/tools/twin/server.py" \
  --port "${PORT}" \
  --mode rate_limit \
  --seed "${SEED}" \
  --artifact-dir "${TWIN_ARTIFACT_DIR}" \
  >"${TMP_DIR}/server.log" 2>&1 &
SERVER_PID=$!

if ! scenario::wait_for_http "http://127.0.0.1:${PORT}/healthz" 5; then
  scenario::fail "twin_boot_failed" "rate-limit twin did not become ready" "rerun via bash scenarios/runner.sh --scenario S-102" "$(cat "${TMP_DIR}/server.log")"
fi

PROBE_JSON="$("${FACTORY_PYTHON}" "${ROOT_DIR}/tools/twin/probe.py" --base-url "http://127.0.0.1:${PORT}" --artifact-dir "${ARTIFACT_DIR}" --seed "${SEED}")"

if ! "${FACTORY_PYTHON}" - "${PROBE_JSON}" "${TWIN_ARTIFACT_DIR}/twin_call_log.jsonl" <<'PY'
import json
import pathlib
import sys

probe = json.loads(sys.argv[1])
call_log_path = pathlib.Path(sys.argv[2])
entries = [json.loads(line) for line in call_log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
assert probe["ok"] is False
assert probe["classification"] == "rate_limit"
assert probe["http_status"] == 429
assert probe["body"]["retry_after"] == 2
assert entries[-1]["status"] == 429
PY
then
  scenario::fail "rate_limit_contract_mismatch" "rate-limit handling drifted" "rerun via bash scenarios/runner.sh --scenario S-102" "${PROBE_JSON}"
fi

scenario::pass "rate-limit twin produced a stable 429 classification and call log"
