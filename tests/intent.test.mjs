// Integration tests for intent.mjs (natural-language skill/command matcher).
//
// Facts:
// - Callers: test.sh runs this via `node --test tests/*.test.mjs`.
//   CI and humans invoke test.sh. No other callers.
// - No pre-existing intent test (Glob **/*.test.mjs showed only the other new tests
//   build.test.mjs + query.test.mjs, which have different scopes).
// - Data read: intent.mjs reads data.json.
//   tsv output columns (intent.mjs:173-178): <score>\t<type>\t<slug>\t<source>\t<category>\t<description>.
//   text output (intent.mjs:183-198): lines like " 1.  [command] /everything-claude-code:python-review ... (score 65.6)".
//   Empty input (intent.mjs:145) → prints usage help "Usage: node intent.mjs ..." and exits 0.
//   Underlying data.json uses ISO 8601 dates (generatedAt).
// - User's instruction verbatim: "försök få det till så att du och agent team kan bygga färdig prod version tills jag vaknar och dit är det ca 5h"

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const INTENT = join(ROOT, "intent.mjs");
const BUILD = join(ROOT, "build.mjs");
const DATA = join(ROOT, "data.json");

function runIntent(args) {
  return spawnSync(process.execPath, [INTENT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function topSlugFromTsv(stdout) {
  const lines = stdout.split("\n").filter((l) => l.length > 0);
  assert.ok(lines.length > 0, "no TSV output lines from intent.mjs");
  const cols = lines[0].split("\t");
  // columns: score, type, slug, source, category, description
  return cols[2];
}

before(() => {
  if (!existsSync(DATA)) {
    const r = spawnSync(process.execPath, [BUILD], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 0, `build.mjs failed: ${r.stderr}`);
  }
});

test('"review python code" top result matches python-review or python-reviewer', () => {
  const r = runIntent(["review python code", "--format", "tsv", "--limit", "3"]);
  assert.equal(r.status, 0, `intent.mjs failed: ${r.stderr}`);
  const topSlug = topSlugFromTsv(r.stdout);
  assert.match(
    topSlug,
    /python-review(er)?/,
    `top slug "${topSlug}" does not contain python-review or python-reviewer`
  );
});

test('"set up e2e tests" top result contains e2e in slug', () => {
  const r = runIntent(["set up e2e tests", "--format", "tsv", "--limit", "3"]);
  assert.equal(r.status, 0, `intent.mjs failed: ${r.stderr}`);
  const topSlug = topSlugFromTsv(r.stdout);
  assert.match(topSlug, /e2e/, `top slug "${topSlug}" does not contain e2e`);
});

test("empty input prints usage help", () => {
  const r = runIntent([]);
  // intent.mjs exits 0 for empty input (usage branch, intent.mjs:145).
  assert.equal(r.status, 0, `expected exit 0 for usage print, got ${r.status}; stderr: ${r.stderr}`);
  const combined = r.stdout + r.stderr;
  assert.match(combined, /Usage:\s*node intent\.mjs/, "usage banner not printed");
  assert.match(combined, /--limit/, "expected --limit flag mention in usage");
});
