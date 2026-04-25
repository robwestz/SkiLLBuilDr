#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="S-101"
DESC="Healthy twin call returns deterministic success output and writes a full call log."

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
SEED="10101"
PORT="$(scenario::choose_port)"
TWIN_ARTIFACT_DIR="${ARTIFACT_DIR}/twin"
mkdir -p "${TWIN_ARTIFACT_DIR}"

"${FACTORY_PYTHON}" "${ROOT_DIR}/tools/twin/server.py" \
  --port "${PORT}" \
  --mode healthy \
  --seed "${SEED}" \
  --artifact-dir "${TWIN_ARTIFACT_DIR}" \
  >"${TMP_DIR}/server.log" 2>&1 &
SERVER_PID=$!

if ! scenario::wait_for_http "http://127.0.0.1:${PORT}/healthz" 5; then
  scenario::fail "twin_boot_failed" "healthy twin did not become ready" "rerun via bash scenarios/runner.sh --scenario S-101" "$(cat "${TMP_DIR}/server.log")"
fi

PROBE_JSON="$("${FACTORY_PYTHON}" "${ROOT_DIR}/tools/twin/probe.py" --base-url "http://127.0.0.1:${PORT}" --artifact-dir "${ARTIFACT_DIR}" --seed "${SEED}")"

if ! "${FACTORY_PYTHON}" - "${PROBE_JSON}" "${TWIN_ARTIFACT_DIR}/twin_call_log.jsonl" <<'PY'
import json
import pathlib
import sys

probe = json.loads(sys.argv[1])
call_log_path = pathlib.Path(sys.argv[2])
entries = [json.loads(line) for line in call_log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
assert probe["ok"] is True
assert probe["classification"] == "success"
assert probe["request_id"] == "req-10101-001"
assert entries[-1]["status"] == 200
assert entries[-1]["payload"]["request_id"] == "req-10101-001"
PY
then
  scenario::fail "healthy_contract_mismatch" "healthy twin contract drifted" "rerun via bash scenarios/runner.sh --scenario S-101" "${PROBE_JSON}"
fi

scenario::pass "healthy twin produced deterministic success payload and request log"
