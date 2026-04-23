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
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, rmSync } from "node:fs";
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

// ---- --sanitize flag tests ----

const SANITIZED_DATA = join(ROOT, "data.sanitized.json");

test("--sanitize: build exits 0, writes valid data, prints [sanitized]", () => {
  const r = spawnSync(process.execPath, [BUILD, "--sanitize"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `build.mjs --sanitize exited non-zero (stderr: ${r.stderr})`);
  assert.ok(r.stdout.includes("[sanitized]"), `stdout should mention [sanitized], got: ${r.stdout}`);
  // Snapshot the sanitized data.json before subsequent tests (or the before() hook) may overwrite it
  const raw = readFileSync(DATA, "utf8");
  writeFileSync(SANITIZED_DATA, raw, "utf8");
});

test("--sanitize: items count > 0 and counts.total matches", () => {
  const data = JSON.parse(readFileSync(SANITIZED_DATA, "utf8"));
  assert.ok(Array.isArray(data.items) && data.items.length > 0, "items array is empty after sanitize");
  assert.equal(data.counts.total, data.items.length, "counts.total mismatch after sanitize");
});

test("--sanitize: no item retains a path field", () => {
  const data = JSON.parse(readFileSync(SANITIZED_DATA, "utf8"));
  for (const it of data.items) {
    assert.ok(!("path" in it), `item "${it.name}" still has a path field: ${it.path}`);
  }
});

test("--sanitize: no item source contains absolute path markers", () => {
  const data = JSON.parse(readFileSync(SANITIZED_DATA, "utf8"));
  const BAD_MARKERS = ["\\", "/Users/", "C:", "/home/"];
  for (const it of data.items) {
    const src = String(it.source ?? "");
    for (const marker of BAD_MARKERS) {
      assert.ok(!src.includes(marker),
        `item "${it.name}" source "${src}" contains absolute path marker "${marker}"`);
    }
  }
});

// ---- --embeddings flag tests ----
// Strategy: @xenova/transformers is a devDependency that may or may not be installed.
// If installed → build must produce data.embeddings.json with correct structure.
// If not installed → build must exit non-zero with a clear install message (graceful degradation).
// The test passes in BOTH cases.

test("--embeddings: either succeeds with valid data.embeddings.json, or fails with clear install message", () => {
  const EMB_JSON = join(ROOT, "data.embeddings.json");
  const r = spawnSync(process.execPath, [BUILD, "--sanitize", "--embeddings"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120_000, // model download can take time
  });

  if (r.status === 0) {
    // Embeddings were generated — validate output file
    assert.ok(existsSync(EMB_JSON), "data.embeddings.json was not written despite exit 0");
    const raw = readFileSync(EMB_JSON, "utf8");
    const emb = JSON.parse(raw);
    assert.equal(typeof emb, "object", "data.embeddings.json should be an object");
    assert.ok(emb !== null && !Array.isArray(emb), "data.embeddings.json should be a plain object");
    const slugs = Object.keys(emb);
    assert.ok(slugs.length > 0, "data.embeddings.json has no entries");
    // Spot-check: every value must be an Array of numbers
    for (const slug of slugs.slice(0, 5)) {
      const vec = emb[slug];
      assert.ok(Array.isArray(vec), `embedding for "${slug}" should be an Array`);
      assert.ok(vec.length > 0, `embedding for "${slug}" should be non-empty`);
      assert.ok(typeof vec[0] === "number", `embedding[0] for "${slug}" should be a number`);
    }
  } else {
    // Package not installed — must print a clear install instruction
    const output = (r.stdout || "") + (r.stderr || "");
    assert.ok(
      output.includes("@xenova/transformers"),
      `Expected install message mentioning @xenova/transformers. Got:\n${output}`
    );
    assert.ok(
      output.includes("npm install"),
      `Expected install message with npm install command. Got:\n${output}`
    );
  }
});

// ---- --workflows flag tests ----

test("--workflows: scans .archon/workflows in given path and includes workflow items", () => {
  // Create a temp directory tree: <tmp>/.archon/workflows/test-flow.yaml
  const tmpDir = join(ROOT, "_workflow_test_fixture");
  const archonDir = join(tmpDir, ".archon", "workflows");
  mkdirSync(archonDir, { recursive: true });
  writeFileSync(join(archonDir, "test-flow.yaml"), [
    "name: test-workflow-fixture",
    "description: A synthetic workflow for testing",
    "on: workflow_dispatch",
    "jobs:",
    "  run:",
    "    steps:",
    "      - id: step-one",
    "      - id: step-two",
  ].join("\n"), "utf8");

  try {
    const r = spawnSync(process.execPath, [BUILD, "--workflows", tmpDir], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `build.mjs --workflows exited non-zero: ${r.stderr}`);

    const data = JSON.parse(readFileSync(DATA, "utf8"));
    const workflows = data.items.filter((it) => it.type === "workflow");
    const fixture = workflows.find((w) => w.name === "test-workflow-fixture");
    assert.ok(fixture, `workflow 'test-workflow-fixture' not found in catalog; all workflows: ${JSON.stringify(workflows.map((w) => w.name))}`);
    assert.equal(fixture.type, "workflow");
    assert.ok(fixture.slug.startsWith("workflow:"), `slug should start with workflow:, got ${fixture.slug}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("--workflows: missing path emits warning but exits 0", () => {
  const r = spawnSync(process.execPath, [BUILD, "--workflows", "/nonexistent/path/xyz"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `should exit 0 even for missing --workflows path, got ${r.status}`);
  const combined = r.stdout + r.stderr;
  assert.ok(combined.includes("not found") || combined.includes("nonexistent"), `expected a warning about the missing path`);
});
