// tests/cli.test.mjs — unit tests for the cli.mjs default-view widgets.
// Verifies loadCliStats + renderDefaultView behave correctly across the
// happy path and degraded states (no data.json, no routines/, no ledger).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadCliStats, renderDefaultView } from "../cli.mjs";

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), "cli-stats-"));
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("loadCliStats: reads version, catalog, sources, routines, ledger", () => {
  const { root, cleanup } = makeRepo();
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "9.9.9" }));
    writeFileSync(
      join(root, "data.json"),
      JSON.stringify({
        items: [
          { slug: "/a:x", source: "alpha" },
          { slug: "/b:y", source: "beta" },
          { slug: "/a:z", source: "alpha" },
        ],
      })
    );
    mkdirSync(join(root, "routines"));
    writeFileSync(join(root, "routines", "r1.routine.json"), "{}");
    writeFileSync(join(root, "routines", "r2.routine.json"), "{}");
    writeFileSync(join(root, "routines", "ignore.txt"), "x"); // non-routine file
    mkdirSync(join(root, ".agents"));
    writeFileSync(
      join(root, ".agents", "TASKS.json"),
      JSON.stringify({ current: "t-042", tasks: [] })
    );

    const stats = loadCliStats(root);
    assert.equal(stats.version, "9.9.9");
    assert.equal(stats.catalog.count, 3);
    assert.equal(stats.catalog.sources, 2);
    assert.equal(stats.catalog.source, "data.json");
    assert.ok(stats.catalog.mtime instanceof Date);
    assert.equal(stats.routines, 2);
    assert.equal(stats.currentTask, "t-042");
  } finally {
    cleanup();
  }
});

test("loadCliStats: graceful degradation when files are missing or malformed", () => {
  const { root, cleanup } = makeRepo();
  try {
    writeFileSync(join(root, "package.json"), "{ not valid json");
    writeFileSync(join(root, "data.json"), "{ also broken");
    mkdirSync(join(root, ".agents"));
    writeFileSync(join(root, ".agents", "TASKS.json"), "[}");

    const stats = loadCliStats(root);
    assert.equal(stats.version, "?");
    assert.equal(stats.catalog.count, 0);
    assert.equal(stats.catalog.sources, 0);
    assert.equal(stats.catalog.source, null);
    assert.equal(stats.routines, 0);
    assert.equal(stats.currentTask, null);
  } finally {
    cleanup();
  }
});

test("renderDefaultView: contains strip, group headers, footer", () => {
  const view = renderDefaultView({
    version: "0.8.0",
    catalog: {
      count: 712,
      sources: 39,
      source: "data.json",
      mtime: new Date(),
    },
    routines: 3,
    currentTask: null,
  });
  assert.match(view, /skill-browser/);
  assert.match(view, /0\.8\.0/);
  assert.match(view, /712 items/);
  assert.match(view, /39 sources/);
  assert.match(view, /3 routines/);
  assert.match(view, /task: —/);
  assert.match(view, /SEARCH/);
  assert.match(view, /DISCOVER/);
  assert.match(view, /ASSEMBLE/);
  assert.match(view, /--goal/);
  assert.match(view, /--recipes/);
  assert.match(view, /--assemble/);
  assert.match(view, /--routine/);
  assert.match(view, /Last updated/);
  assert.match(view, /data\.json/);
  assert.match(view, /fresh/);
});

test("renderDefaultView: degraded mode shows actionable footer when data.json missing", () => {
  const view = renderDefaultView({
    version: "0.8.0",
    catalog: { count: 0, sources: 0, source: null, mtime: null },
    routines: 0,
    currentTask: null,
  });
  assert.match(view, /0 items/);
  assert.match(view, /0 sources/);
  assert.match(view, /0 routines/);
  assert.match(view, /no data\.json/);
  assert.match(view, /node build\.mjs/);
});

test("renderDefaultView: surfaces current task when ledger has one", () => {
  const view = renderDefaultView({
    version: "0.8.0",
    catalog: { count: 1, sources: 1, source: "data.json", mtime: new Date() },
    routines: 1,
    currentTask: "t-018",
  });
  assert.match(view, /task: t-018/);
});

test("renderDefaultView: stale freshness when mtime is old", () => {
  const old = new Date(Date.now() - 30 * 86_400_000); // 30 days
  const view = renderDefaultView({
    version: "0.8.0",
    catalog: { count: 1, sources: 1, source: "data.json", mtime: old },
    routines: 0,
    currentTask: null,
  });
  assert.match(view, /stale/);
});
