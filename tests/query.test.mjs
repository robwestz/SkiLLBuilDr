// Integration tests for query.mjs.
//
// Facts:
// - Callers: test.sh (same directory parent's test.sh) runs this via `node --test tests/*.test.mjs`.
//   CI and humans run test.sh.
// - No pre-existing test covered query.mjs (Glob of **/*.test.mjs showed only build.test.mjs,
//   which is the build smoke test).
// - Data read: query.mjs reads data.json and writes TSV to stdout or JSON with --format json.
//   TSV columns: type\tslug\tsource\tcategory\tdescription.
//   --list-categories prints "<count>  <name>" per line (regex /^\s*\d+\s+\S/).
//   Default limit = 50.
//   Underlying data.json uses ISO 8601 dates (via new Date().toISOString()).
// - User's instruction verbatim: "försök få det till så att du och agent team kan bygga färdig prod version tills jag vaknar och dit är det ca 5h"

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const QUERY = join(ROOT, "query.mjs");
const BUILD = join(ROOT, "build.mjs");
const DATA = join(ROOT, "data.json");

function runQuery(args) {
  return spawnSync(process.execPath, [QUERY, ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

before(() => {
  if (!existsSync(DATA)) {
    const r = spawnSync(process.execPath, [BUILD], { cwd: ROOT, encoding: "utf8" });
    assert.equal(r.status, 0, `build.mjs failed: ${r.stderr}`);
  }
});

test("no args prints a reasonable number of TSV lines", () => {
  const r = runQuery([]);
  assert.equal(r.status, 0, `query.mjs failed: ${r.stderr}`);
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);
  assert.ok(lines.length > 0, "no output lines");
  // default limit is 50; allow a generous band
  assert.ok(lines.length <= 50, `got ${lines.length} lines, expected <=50`);
  // each line should have tab-separated columns (at least 4 tabs → 5 fields)
  for (const line of lines) {
    const cols = line.split("\t");
    assert.ok(cols.length >= 4, `line has only ${cols.length} columns: ${line}`);
  }
});

test("--list-categories prints category list", () => {
  const r = runQuery(["--list-categories"]);
  assert.equal(r.status, 0, `query.mjs failed: ${r.stderr}`);
  const combined = r.stdout + r.stderr;
  assert.ok(combined.length > 0, "no output from --list-categories");
  const lines = r.stdout.split("\n").filter((l) => l.trim().length > 0);
  assert.ok(lines.length > 0, "no category lines on stdout");
  // Each line should start with whitespace-padded count, then a name.
  for (const line of lines) {
    assert.match(line, /^\s*\d+\s+\S/, `bad category line: ${line}`);
  }
});

test("--format json produces a valid JSON array", () => {
  const r = runQuery(["--format", "json"]);
  assert.equal(r.status, 0, `query.mjs failed: ${r.stderr}`);
  const parsed = JSON.parse(r.stdout);
  assert.ok(Array.isArray(parsed), "output is not an array");
  assert.ok(parsed.length > 0, "empty array");
  for (const it of parsed.slice(0, 5)) {
    assert.ok(typeof it.type === "string");
    const validSlug = it.type === "rule" ? it.slug.startsWith("rule:")
      : it.type === "workflow" ? it.slug.startsWith("workflow:")
      : it.slug.startsWith("/");
    assert.ok(typeof it.slug === "string" && validSlug);
  }
});

test("--source plugin:everything-claude-code --limit 3 yields 3 lines all from that source", () => {
  const r = runQuery(["--source", "plugin:everything-claude-code", "--limit", "3"]);
  assert.equal(r.status, 0, `query.mjs failed: ${r.stderr}`);
  const lines = r.stdout.split("\n").filter((l) => l.length > 0);
  assert.equal(lines.length, 3, `expected 3 lines, got ${lines.length}`);
  for (const line of lines) {
    const cols = line.split("\t");
    // TSV columns: type, slug, source, category, description
    assert.equal(cols[2], "plugin:everything-claude-code",
      `source column mismatch on line: ${line}`);
  }
});

test("--format json --source plugin:everything-claude-code --limit 3 yields 3-item array", () => {
  const r = runQuery([
    "--format", "json",
    "--source", "plugin:everything-claude-code",
    "--limit", "3",
  ]);
  assert.equal(r.status, 0, `query.mjs failed: ${r.stderr}`);
  const arr = JSON.parse(r.stdout);
  assert.ok(Array.isArray(arr));
  assert.equal(arr.length, 3, `expected 3 items, got ${arr.length}`);
  for (const it of arr) {
    assert.equal(it.source, "plugin:everything-claude-code");
  }
});
