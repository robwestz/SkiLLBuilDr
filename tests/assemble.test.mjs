import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { parseStoreZip } from "../zip-builder.mjs";
import {
  buildPhase0Block,
  buildCompoundBlock,
  buildQualityGateBlock,
  buildKickoffWithPhase0,
  TIERS,
} from "../kickoff-template.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSEMBLE = join(ROOT, "assemble.mjs");

// ─── Pure-function tests for the new template exports ─────────────────────

test("TIERS exposes mvp / production / cutting-edge", () => {
  assert.deepEqual(TIERS, ["mvp", "production", "cutting-edge"]);
});

test("buildPhase0Block contains all six sub-blocks 0.1–0.6", () => {
  const out = buildPhase0Block({ goal: "test goal", tier: "production" });
  assert.match(out, /### 0\.1 Goal restate/);
  assert.match(out, /### 0\.2 Skill-scan/);
  assert.match(out, /### 0\.3 Skill-first fallback/);
  assert.match(out, /### 0\.4 Definition of Done/);
  assert.match(out, /### 0\.5 Hard gates/);
  assert.match(out, /### 0\.6 Contract signed/);
});

test("buildPhase0Block reflects the chosen tier in DoD section", () => {
  const mvp = buildPhase0Block({ goal: "x", tier: "mvp" });
  const cuttingEdge = buildPhase0Block({ goal: "x", tier: "cutting-edge" });
  assert.match(mvp, /\*\*Tier:\*\* MVP/);
  assert.match(cuttingEdge, /\*\*Tier:\*\* Cutting-edge/);
});

test("buildPhase0Block renders chunkPlan when provided", () => {
  const out = buildPhase0Block({
    goal: "x",
    tier: "production",
    chunkPlan: [
      { name: "Setup", done: "tests green" },
      { name: "Build", dependsOn: [1], skills: ["/x:y"], done: "feature works" },
    ],
  });
  assert.match(out, /## Chunk Plan/);
  assert.match(out, /### C1 — Setup/);
  assert.match(out, /### C2 — Build/);
  assert.match(out, /\*\*Depends on:\*\* C1/);
  assert.match(out, /\*\*Skills used:\*\* `\/x:y`/);
});

test("buildCompoundBlock contains GAP SCAN + COMPOUND + CONTEXT REFRESH triggers", () => {
  const out = buildCompoundBlock();
  assert.match(out, /\[GAP SCAN\]/);
  assert.match(out, /\[COMPOUND\]/);
  assert.match(out, /\[CONTEXT REFRESH\]/);
});

test("buildQualityGateBlock includes 5 dimensions and the chosen tier label", () => {
  const out = buildQualityGateBlock({ tier: "cutting-edge" });
  for (const dim of ["Correctness", "Architecture", "Cost-efficiency", "Maintainability", "Originality"]) {
    assert.ok(out.includes(dim), `expected dimension "${dim}" in QG block`);
  }
  assert.match(out, /Cutting-edge/);
});

test("buildKickoffWithPhase0 contains all four required blocks", () => {
  const out = buildKickoffWithPhase0({
    goal: "test goal",
    nodes: [{ slug: "/x", name: "X" }],
    tier: "production",
  });
  assert.match(out, /Phase 0 — Preflight Contract/);
  assert.match(out, /Compound Mechanisms/);
  assert.match(out, /Quality Gate/);
  assert.match(out, /## Goal/); // base buildKickoff still in
});

// ─── CLI integration tests (spawn subprocess) ─────────────────────────────

test("assemble.mjs --help exits 0 and prints usage", () => {
  const r = spawnSync(process.execPath, [ASSEMBLE, "--help"], { encoding: "utf-8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Usage:/);
  assert.match(r.stdout, /--goal/);
});

test("assemble.mjs without --goal exits 1 with error", () => {
  const r = spawnSync(process.execPath, [ASSEMBLE], { encoding: "utf-8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--goal is required/);
});

test("assemble.mjs with invalid --tier exits 1", () => {
  const r = spawnSync(
    process.execPath,
    [ASSEMBLE, "--goal", "x", "--tier", "bogus"],
    { encoding: "utf-8" }
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--tier must be one of/);
});

test("assemble.mjs --auto produces a valid ZIP with KICKOFF/CLAUDE/README", () => {
  // Skip if no catalog (CI without build step)
  if (!existsSync(join(ROOT, "data.json")) && !existsSync(join(ROOT, "data.public.js"))) {
    return; // node:test treats no-throw as pass
  }
  const tempOut = mkdtempSync(join(tmpdir(), "assemble-test-"));
  try {
    const r = spawnSync(
      process.execPath,
      [
        ASSEMBLE,
        "--goal",
        "review python code for security",
        "--tier",
        "production",
        "--limit",
        "5",
        "--auto",
        "--out",
        tempOut,
      ],
      { encoding: "utf-8", timeout: 30_000 }
    );
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}. stderr: ${r.stderr}`);
    assert.match(r.stdout, /Package written/);

    const zipFiles = readdirSync(tempOut).filter((f) => f.endsWith(".zip"));
    assert.equal(zipFiles.length, 1, "exactly one zip should be produced");

    const zipBytes = readFileSync(join(tempOut, zipFiles[0]));
    const files = parseStoreZip(new Uint8Array(zipBytes));
    const names = files.map((f) => f.name);
    for (const required of ["CLAUDE.md", "KICKOFF.md", "README.md"]) {
      assert.ok(names.includes(required), `missing required file: ${required}`);
    }
    // Frameworks bundled so the package is self-contained
    const fwFiles = names.filter((n) => n.startsWith("frameworks/"));
    assert.ok(fwFiles.length >= 5, `expected at least 5 framework files, got ${fwFiles.length}`);

    const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
    assert.match(kickoff, /Phase 0 — Preflight Contract/);
    assert.match(kickoff, /Skill-first fallback/);
    assert.match(kickoff, /Compound Mechanisms/);
    assert.match(kickoff, /Quality Gate/);
  } finally {
    rmSync(tempOut, { recursive: true, force: true });
  }
});

test("assemble.mjs respects --tier mvp in KICKOFF output", () => {
  if (!existsSync(join(ROOT, "data.json")) && !existsSync(join(ROOT, "data.public.js"))) {
    return;
  }
  const tempOut = mkdtempSync(join(tmpdir(), "assemble-test-mvp-"));
  try {
    const r = spawnSync(
      process.execPath,
      [
        ASSEMBLE,
        "--goal",
        "build cli tool for testing",
        "--tier",
        "mvp",
        "--limit",
        "4",
        "--auto",
        "--out",
        tempOut,
      ],
      { encoding: "utf-8", timeout: 30_000 }
    );
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}. stderr: ${r.stderr}`);
    const zipFiles = readdirSync(tempOut).filter((f) => f.endsWith(".zip"));
    const zipBytes = readFileSync(join(tempOut, zipFiles[0]));
    const files = parseStoreZip(new Uint8Array(zipBytes));
    const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
    assert.match(kickoff, /\*\*Tier:\*\* MVP/);
  } finally {
    rmSync(tempOut, { recursive: true, force: true });
  }
});
