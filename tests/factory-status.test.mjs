// tests/factory-status.test.mjs — exercise factory-status.mjs against synthetic fixtures.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { collectStatus } from "../factory-status.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CLI = join(ROOT, "factory-status.mjs");

function makeFakeRepo() {
  const root = mkdtempSync(join(tmpdir(), "factory-status-test-"));
  writeFileSync(
    join(root, "data.json"),
    JSON.stringify({ items: [
      { slug: "/a", name: "a", description: "", category: "x", type: "skill" },
      { slug: "/b", name: "b", description: "", category: "y", type: "skill" },
    ] })
  );
  mkdirSync(join(root, "routines"));
  writeFileSync(
    join(root, "routines", "demo.routine.json"),
    JSON.stringify({
      version: 1,
      id: "demo",
      title: "Demo",
      cadence: "manual",
      steps: [{ kind: "skill", ref: "/a" }, { kind: "shell", ref: "echo" }],
    })
  );
  mkdirSync(join(root, ".agents"));
  writeFileSync(
    join(root, ".agents", "TASKS.json"),
    JSON.stringify({
      version: "1",
      current: "t-demo",
      tasks: [
        { id: "t-demo", state: "in_progress" },
        { id: "t-old1", state: "done" },
        { id: "t-old2", state: "parked" },
      ],
    })
  );
  return root;
}

// ─── collectStatus shape ──────────────────────────────────────────────────

test("collectStatus reads catalog count, routines, and task tally", () => {
  const root = makeFakeRepo();
  try {
    const s = collectStatus(root);
    assert.equal(s.catalog.count, 2);
    assert.equal(s.catalog.source, "data.json");
    assert.equal(s.routines.length, 1);
    assert.equal(s.routines[0].id, "demo");
    assert.equal(s.routines[0].step_count, 2);
    assert.equal(s.tasks.total, 3);
    assert.equal(s.tasks.in_progress, 1);
    assert.equal(s.tasks.done, 1);
    assert.equal(s.tasks.parked, 1);
    assert.equal(s.current_task, "t-demo");
    assert.match(s.generated_at, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectStatus tolerates a missing routines/ directory", () => {
  const root = mkdtempSync(join(tmpdir(), "factory-status-test-empty-"));
  try {
    const s = collectStatus(root);
    assert.deepEqual(s.routines, []);
    assert.equal(s.catalog.count, 0);
    assert.equal(s.tasks.total, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectStatus tolerates a malformed TASKS.json", () => {
  const root = mkdtempSync(join(tmpdir(), "factory-status-test-bad-ledger-"));
  try {
    mkdirSync(join(root, ".agents"));
    writeFileSync(join(root, ".agents", "TASKS.json"), "{ not json");
    const s = collectStatus(root);
    assert.equal(s.tasks.total, 0);
    assert.equal(s.current_task, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ─── CLI smoke ─────────────────────────────────────────────────────────────

test("factory-status.mjs --json against the real repo prints valid JSON with required fields", () => {
  const r = spawnSync(process.execPath, [CLI, "--json"], { encoding: "utf-8", timeout: 10_000 });
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  const parsed = JSON.parse(r.stdout);
  assert.ok(typeof parsed.generated_at === "string");
  assert.ok(parsed.catalog && typeof parsed.catalog.count === "number");
  assert.ok(Array.isArray(parsed.routines));
  assert.ok(parsed.tasks && typeof parsed.tasks.total === "number");
});

test("factory-status.mjs (text mode) names the factory in its header", () => {
  const r = spawnSync(process.execPath, [CLI], { encoding: "utf-8", timeout: 10_000 });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Agentic Factory v1/);
  assert.match(r.stdout, /Catalog/);
  assert.match(r.stdout, /Routines/);
  assert.match(r.stdout, /Tasks/);
});
