#!/usr/bin/env bash
set -euo pipefail

SCENARIO_ID="S-103"
DESC="5xx twin mode returns deterministic upstream failure classification and preserves full operator diagnostics in artifacts."

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
SEED="30303"
PORT="$(scenario::choose_port)"
TWIN_ARTIFACT_DIR="${ARTIFACT_DIR}/twin"
mkdir -p "${TWIN_ARTIFACT_DIR}"

"${FACTORY_PYTHON}" "${ROOT_DIR}/tools/twin/server.py" \
  --port "${PORT}" \
  --mode 5xx \
  --seed "${SEED}" \
  --artifact-dir "${TWIN_ARTIFACT_DIR}" \
  >"${TMP_DIR}/server.log" 2>&1 &
SERVER_PID=$!

if ! scenario::wait_for_http "http://127.0.0.1:${PORT}/healthz" 5; then
  scenario::fail "twin_boot_failed" "5xx twin did not become ready" "rerun via bash scenarios/runner.sh --scenario S-103" "$(cat "${TMP_DIR}/server.log")"
fi

PROBE_JSON="$("${FACTORY_PYTHON}" "${ROOT_DIR}/tools/twin/probe.py" --base-url "http://127.0.0.1:${PORT}" --artifact-dir "${ARTIFACT_DIR}" --seed "${SEED}")"

if ! "${FACTORY_PYTHON}" - "${PROBE_JSON}" "${TWIN_ARTIFACT_DIR}/twin_call_log.jsonl" "${ARTIFACT_DIR}/probe_result.json" <<'PY'
import json
import pathlib
import sys

probe = json.loads(sys.argv[1])
call_log_path = pathlib.Path(sys.argv[2])
probe_artifact = pathlib.Path(sys.argv[3])
entries = [json.loads(line) for line in call_log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
assert probe["ok"] is False
assert probe["classification"] == "upstream_5xx"
assert probe["http_status"] == 503
assert probe["body"]["error"] == "upstream_unavailable"
assert entries[-1]["status"] == 503
assert probe_artifact.exists()
PY
then
  scenario::fail "upstream_failure_contract_mismatch" "5xx handling drifted" "rerun via bash scenarios/runner.sh --scenario S-103" "${PROBE_JSON}"
fi

scenario::pass "5xx twin produced a stable upstream failure classification with operator artifacts"
