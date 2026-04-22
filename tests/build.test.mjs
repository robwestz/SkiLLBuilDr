// Smoke test for build.mjs.
//
// Facts:
// - Callers: test.sh runs this via `node --test tests/*.test.mjs`; CI and humans run test.sh.
// - No pre-existing tests (verified by Glob of **/*.test.mjs before this file was written).
// - Data read: data.json written by build.mjs; expected shape:
//     {generatedAt, sources[], counts{total,skills,commands}, categories{}, scopes{}, sourcesCount{}, items[]}
//   items[i] keys: type, name, slug, description, origin, category, scope, source, namespace, path.
//   Date format: ISO 8601 (new Date().toISOString()).
// - User's instruction verbatim: "försök få det till så att du och agent team kan bygga färdig prod version tills jag vaknar och dit är det ca 5h"
//
// Strategy: run build.mjs as a child process, assert data.json exists and is structurally valid.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const BUILD = join(ROOT, "build.mjs");
const DATA = join(ROOT, "data.json");

before(() => {
  // Always run build so we exercise the CLI. build.mjs writes data.json + data.js + recipes.js.
  const r = spawnSync(process.execPath, [BUILD], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `build.mjs exited non-zero (stderr: ${r.stderr})`);
});

test("data.json exists on disk after build", () => {
  assert.ok(existsSync(DATA), "data.json was not written");
  const st = statSync(DATA);
  assert.ok(st.size > 0, "data.json is empty");
});

test("data.json parses as JSON", () => {
  const raw = readFileSync(DATA, "utf8");
  const data = JSON.parse(raw);
  assert.equal(typeof data, "object");
  assert.ok(data !== null, "parsed data is null");
});

test("data has items array with length > 100", () => {
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  assert.ok(Array.isArray(data.items), "data.items is not an array");
  assert.ok(data.items.length > 100, `items.length=${data.items.length} should be > 100`);
});

test("data has categories object with entries", () => {
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  assert.equal(typeof data.categories, "object");
  assert.ok(data.categories !== null, "categories is null");
  assert.ok(!Array.isArray(data.categories), "categories should be a plain object");
  assert.ok(Object.keys(data.categories).length > 0, "categories has no entries");
});

test("data.counts.total matches items.length", () => {
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  assert.equal(typeof data.counts, "object");
  assert.equal(data.counts.total, data.items.length,
    `counts.total=${data.counts.total} != items.length=${data.items.length}`);
});

test("data.counts agents + skills + commands + rules + workflows == counts.total", () => {
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  assert.equal(
    (data.counts.agents ?? 0) + data.counts.skills + data.counts.commands + (data.counts.rules ?? 0) + (data.counts.workflows ?? 0),
    data.counts.total,
    "agents+skills+commands+rules+workflows should equal total"
  );
});

test("each item has required fields (first 50 sampled)", () => {
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  for (const it of data.items.slice(0, 50)) {
    assert.ok(typeof it.type === "string", "item.type missing");
    assert.ok(["skill", "command", "agent", "rule", "workflow"].includes(it.type), `bad type: ${it.type}`);
    assert.ok(typeof it.name === "string" && it.name.length > 0, "item.name missing");
    const validSlug = it.type === "rule" ? it.slug.startsWith("rule:")
      : it.type === "workflow" ? it.slug.startsWith("workflow:")
      : it.slug.startsWith("/");
    assert.ok(typeof it.slug === "string" && validSlug, `bad slug: ${it.slug}`);
    assert.ok(typeof it.category === "string", "item.category missing");
    assert.ok(typeof it.scope === "string", "item.scope missing");
  }
});
