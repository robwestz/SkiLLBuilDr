#!/usr/bin/env bash
set -euo pipefail

scenario::init() {
  : "${SCENARIO_ID:?SCENARIO_ID must be set}"
  : "${DESC:?DESC must be set}"
  : "${SUT_ROOT:?SUT_ROOT must be set}"
  : "${ARTIFACT_DIR:?ARTIFACT_DIR must be set}"
  : "${FACTORY_PYTHON:?FACTORY_PYTHON must be set by runner}"
  mkdir -p "${ARTIFACT_DIR}"
  HUMAN="${ARTIFACT_DIR}/human_debug.txt"
  BUILDER="${ARTIFACT_DIR}/builder_feedback.json"
  export HUMAN BUILDER
}

scenario::write_builder_feedback() {
  local status="$1"
  local class_name="$2"
  local symptom="$3"
  local repro="$4"
  "${FACTORY_PYTHON}" - "$BUILDER" "$SCENARIO_ID" "$status" "$class_name" "$symptom" "$repro" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
payload = {
    "scenario_id": sys.argv[2],
    "status": sys.argv[3],
    "class": sys.argv[4],
    "symptom": sys.argv[5],
    "high_level_repro": sys.argv[6],
}
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
}

scenario::choose_port() {
  "${FACTORY_PYTHON}" - <<'PY'
import socket

sock = socket.socket()
sock.bind(("127.0.0.1", 0))
print(sock.getsockname()[1])
sock.close()
PY
}

scenario::wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-5}"
  "${FACTORY_PYTHON}" - "$url" "$timeout_seconds" <<'PY'
import sys
import time
import urllib.request

url = sys.argv[1]
deadline = time.time() + float(sys.argv[2])
while time.time() < deadline:
    try:
        with urllib.request.urlopen(url, timeout=0.5) as response:
            if response.status == 200:
                raise SystemExit(0)
    except Exception:
        time.sleep(0.1)
raise SystemExit(1)
PY
}

scenario::pass() {
  local summary="$1"
  printf 'Scenario: %s\nDESC: %s\nSTATUS: PASS\nSUMMARY: %s\n' "$SCENARIO_ID" "$DESC" "$summary" > "$HUMAN"
  scenario::write_builder_feedback "PASS" "none" "scenario satisfied expected behavior" "rerun via bash scenarios/runner.sh"
  echo "PASS ${SCENARIO_ID}: ${summary}"
  exit 0
}

scenario::fail() {
  local class_name="$1"
  local symptom="$2"
  local repro="$3"
  shift 3
  {
    printf 'Scenario: %s\nDESC: %s\nSTATUS: FAIL\nCLASS: %s\nSYMPTOM: %s\nREPRO: %s\n' "$SCENARIO_ID" "$DESC" "$class_name" "$symptom" "$repro"
    if [[ $# -gt 0 ]]; then
      printf '\nDETAILS:\n%s\n' "$*"
    fi
  } > "$HUMAN"
  scenario::write_builder_feedback "FAIL" "$class_name" "$symptom" "$repro"
  echo "FAIL ${SCENARIO_ID}: ${class_name}"
  exit 1
}

scenario::skip() {
  local reason="$1"
  printf 'Scenario: %s\nDESC: %s\nSTATUS: SKIP\nREASON: %s\n' "$SCENARIO_ID" "$DESC" "$reason" > "$HUMAN"
  scenario::write_builder_feedback "SKIP" "skipped" "$reason" "inspect human_debug.txt for environment details"
  echo "SKIP ${SCENARIO_ID}: ${reason}"
  exit 2
}
