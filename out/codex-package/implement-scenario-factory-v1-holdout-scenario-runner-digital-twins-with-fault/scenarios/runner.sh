#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

choose_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  if command -v python >/dev/null 2>&1; then
    command -v python
    return 0
  fi
  echo "python3-or-python-not-found" >&2
  return 1
}

FACTORY_PYTHON="${FACTORY_PYTHON:-$(choose_python)}"
export FACTORY_PYTHON
export FACTORY_BASH="${FACTORY_BASH:-${BASH}}"

exec "${FACTORY_PYTHON}" "${WORKSPACE_ROOT}/tools/factory/runner.py" "$@"
