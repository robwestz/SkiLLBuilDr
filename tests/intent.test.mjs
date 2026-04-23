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

test("query of only stopwords exits 1 with error", () => {
  // "the and to" are all stopwords → tokenize() returns [] → exit 1
  const r = runIntent(["the", "and", "to"]);
  assert.equal(r.status, 1, `expected exit 1 for stopwords-only query, got ${r.status}`);
  assert.match(r.stderr, /No meaningful tokens/, "expected 'No meaningful tokens' in stderr");
});

test("--limit 1 returns exactly one TSV result line", () => {
  const r = runIntent(["review python code", "--format", "tsv", "--limit", "1"]);
  assert.equal(r.status, 0, `intent.mjs failed: ${r.stderr}`);
  const lines = r.stdout.split("\n").filter((l) => l.trim().length > 0);
  assert.equal(lines.length, 1, `expected 1 result line, got ${lines.length}`);
});

test("--format json returns a valid JSON array with slug and score fields", () => {
  const r = runIntent(["review python code", "--format", "json", "--limit", "3"]);
  assert.equal(r.status, 0, `intent.mjs failed: ${r.stderr}`);
  let items;
  try {
    items = JSON.parse(r.stdout);
  } catch (e) {
    assert.fail(`output is not valid JSON: ${r.stdout.slice(0, 200)}`);
  }
  assert.ok(Array.isArray(items), "JSON output should be an array");
  assert.ok(items.length > 0, "JSON array should be non-empty");
  for (const item of items) {
    assert.ok(typeof item.slug === "string", "each item should have a string slug");
    assert.ok(typeof item._score === "number", "each item should have a numeric _score");
  }
});

test("--type skill filter returns only skill-type results", () => {
  const r = runIntent(["review code", "--format", "tsv", "--limit", "10", "--type", "skill"]);
  assert.equal(r.status, 0, `intent.mjs failed: ${r.stderr}`);
  const lines = r.stdout.split("\n").filter((l) => l.trim().length > 0);
  assert.ok(lines.length > 0, "expected at least one result for 'review code --type skill'");
  for (const line of lines) {
    const cols = line.split("\t");
    // columns: score, type, slug, source, category, description
    assert.equal(cols[1], "skill", `expected type=skill, got '${cols[1]}' in line: ${line}`);
  }
});

test("non-ASCII input does not crash (Swedish query)", () => {
  // Non-ASCII chars like ä/ö are stripped by tokenize's [^\w\s+/#.-] regex.
  // "granska" and "s" (from "säkerhet") — at least one token survives.
  const r = runIntent(["granska kod säkerhet", "--format", "tsv", "--limit", "3"]);
  // Should not crash; may return results (0) or exit 1 if all tokens stripped
  assert.ok(r.status === 0 || r.status === 1, `unexpected exit code ${r.status}; stderr: ${r.stderr}`);
  if (r.status === 1) {
    assert.match(r.stderr, /No meaningful tokens/, "exit 1 should only occur for stopword/empty-token reason");
  }
});
