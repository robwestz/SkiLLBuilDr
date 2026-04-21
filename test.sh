#!/usr/bin/env bash
# Run the ECC browser test suite.
#
# Facts:
# - Callers: humans and CI invoke this directly (`bash test.sh`).
#   No in-repo script wraps it (launch.sh is for the static viewer, not tests).
# - No prior test.sh existed (initial directory listing showed only launch.sh
#   among .sh files, and that one is unrelated).
# - Data: this script itself reads no data files. Transitively the tests it runs
#   (via `node --test tests/*.test.mjs`) read data.json (generatedAt = ISO 8601)
#   and recipes.json (generatedAt = "YYYY-MM-DD"). build.mjs may also be invoked
#   to (re)write data.json + data.js + recipes.js.
# - User's instruction verbatim: "försök få det till så att du och agent team kan bygga färdig prod version tills jag vaknar och dit är det ca 5h"
#
# Exits non-zero on any test failure (set -e + node --test propagates).

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
cd "$here"

# Ensure data.json exists before running tests (individual tests also handle this,
# but building once up front is faster than per-test).
if [ ! -f "data.json" ]; then
  echo ">> data.json missing; running build.mjs..." >&2
  node ./build.mjs
fi

echo ">> running node --test tests/*.test.mjs" >&2
node --test tests/*.test.mjs
