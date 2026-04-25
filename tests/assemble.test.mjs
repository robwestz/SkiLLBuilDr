import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { parseStoreZip } from "../zip-builder.mjs";
import {
  buildPhase0Block,
  buildCompoundBlock,
  buildEvalLoopBlock,
  buildScenarioGateBlock,
  buildQualityGateBlock,
  buildKickoffWithPhase0,
  buildDebateBlock,
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

test("buildKickoffWithPhase0 contains all five required blocks", () => {
  const out = buildKickoffWithPhase0({
    goal: "test goal",
    nodes: [{ slug: "/x", name: "X" }],
    tier: "production",
  });
  assert.match(out, /Phase 0 — Preflight Contract/);
  assert.match(out, /Compound Mechanisms/);
  assert.match(out, /Eval Loop/);
  assert.match(out, /Quality Gate/);
  assert.match(out, /## Goal/); // base buildKickoff still in
});

test("buildEvalLoopBlock requires both CRITIQUE and PRAISE with minimums", () => {
  const out = buildEvalLoopBlock({ tier: "production" });
  assert.match(out, /\[EVAL LOOP/);
  assert.match(out, /CRITIQUE \(≥2\)/);
  assert.match(out, /PRAISE   \(≥2\)/);
  assert.match(out, /PRESERVE/);
  assert.match(out, /FIX/);
  assert.match(out, /DEFER/);
  assert.match(out, /DECISION:.*proceed.*rework.*escalate/);
});

test("buildEvalLoopBlock raises minimums to 3 for cutting-edge tier", () => {
  const out = buildEvalLoopBlock({ tier: "cutting-edge" });
  assert.match(out, /CRITIQUE \(≥3\)/);
  assert.match(out, /PRAISE   \(≥3\)/);
});

test("EVAL LOOP appears between Compound Mechanisms and Quality Gate in KICKOFF", () => {
  const out = buildKickoffWithPhase0({
    goal: "x",
    nodes: [{ slug: "/x", name: "X" }],
    tier: "production",
  });
  const compoundIdx = out.indexOf("Compound Mechanisms");
  const evalIdx = out.indexOf("Eval Loop");
  const qgIdx = out.indexOf("Quality Gate");
  assert.ok(compoundIdx > 0, "compound block missing");
  assert.ok(evalIdx > compoundIdx, "eval loop must appear after compound block");
  assert.ok(qgIdx > evalIdx, "quality gate must appear after eval loop");
});

test("buildScenarioGateBlock returns empty string when no gatePath given", () => {
  assert.equal(buildScenarioGateBlock({}), "");
  assert.equal(buildScenarioGateBlock({ gatePath: null }), "");
});

test("buildScenarioGateBlock contains the path, runner cmd, and threat-model rules", () => {
  const out = buildScenarioGateBlock({ gatePath: "factory/v1" });
  assert.match(out, /Scenario Gate/);
  assert.match(out, /factory\/v1/);
  assert.match(out, /bash factory\/v1\/scenarios\/runner\.sh --json --timeout 15/);
  assert.match(out, /Pass policy/);
  assert.match(out, /Do NOT read scenarios under/);
  assert.match(out, /Do NOT modify files under/);
});

test("buildKickoffWithPhase0 includes Scenario Gate block when gatePath is given", () => {
  const withGate = buildKickoffWithPhase0({
    goal: "x",
    nodes: [{ slug: "/x", name: "X" }],
    tier: "production",
    gatePath: "factory/v1",
  });
  assert.match(withGate, /Scenario Gate/);
  // Must appear AFTER eval loop and BEFORE quality gate
  const evalIdx = withGate.indexOf("Eval Loop");
  const gateIdx = withGate.indexOf("Scenario Gate");
  const qgIdx = withGate.indexOf("Quality Gate");
  assert.ok(evalIdx < gateIdx, "scenario gate must appear after eval loop");
  assert.ok(gateIdx < qgIdx, "scenario gate must appear before quality gate");
});

test("buildKickoffWithPhase0 omits Scenario Gate block when gatePath is null", () => {
  const noGate = buildKickoffWithPhase0({
    goal: "x",
    nodes: [{ slug: "/x", name: "X" }],
    tier: "production",
  });
  assert.doesNotMatch(noGate, /Scenario Gate/);
});

test("buildKickoffWithPhase0 renders auto-onboarding and Phase 0 prefill", () => {
  const out = buildKickoffWithPhase0({
    goal: "x",
    nodes: [{ slug: "/x", name: "X" }],
    tier: "production",
    autoOnboard: true,
    prefill: {
      restatement: "Build the requested package without extra operator questions.",
      skillScan: "partial",
      dod: {
        acceptanceCriteria: ["KICKOFF is prefilled", "Agent can re-sign Phase 0"],
        verification: "Inspect generated KICKOFF.md",
        directlyUsable: "Run assemble.mjs with --auto-phase0",
      },
      signedBy: "operator",
      timestamp: "2026-04-25T12:00:00.000Z",
    },
  });

  assert.match(out, /Pre-onboarding \(operator-confirmed\)/);
  assert.match(out, /PRE-FILLED by operator/);
  assert.match(out, /Your restatement: \*\*Build the requested package/);
  assert.match(out, /- \[x\] \*\*Partial:\*\*/);
  assert.match(out, /\*\*KICKOFF is prefilled\*\*/);
  assert.match(out, /_Signed by: \*\*operator\*\*_/);
});

test("assemble.mjs --scenario-gate with non-existent path exits 1", () => {
  const r = spawnSync(
    process.execPath,
    [ASSEMBLE, "--goal", "x", "--scenario-gate", "/nonexistent/path-xyz"],
    { encoding: "utf-8" }
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing required scenarios\/runner\.sh/);
});

test("assemble.mjs --scenario-gate factory/v1 produces KICKOFF with gate block", () => {
  if (!existsSync(join(ROOT, "data.json")) && !existsSync(join(ROOT, "data.public.js"))) return;
  if (!existsSync(join(ROOT, "factory", "v1", "scenarios", "runner.sh"))) return;
  const tempOut = mkdtempSync(join(tmpdir(), "assemble-gate-test-"));
  try {
    const r = spawnSync(
      process.execPath,
      [
        ASSEMBLE,
        "--goal", "test gated build",
        "--tier", "production",
        "--limit", "4",
        "--auto",
        "--scenario-gate", "factory/v1",
        "--out", tempOut,
      ],
      { encoding: "utf-8", timeout: 30_000 }
    );
    assert.equal(r.status, 0, `expected 0, stderr: ${r.stderr}`);
    assert.match(r.stdout, /Scenario gate: factory\/v1/);
    const zipFiles = readdirSync(tempOut).filter((f) => f.endsWith(".zip"));
    const zipBytes = readFileSync(join(tempOut, zipFiles[0]));
    const files = parseStoreZip(new Uint8Array(zipBytes));
    const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
    assert.match(kickoff, /Scenario Gate/);
    assert.match(kickoff, /factory\/v1\/scenarios\/runner\.sh/);
  } finally {
    rmSync(tempOut, { recursive: true, force: true });
  }
});

// ─── CLI integration tests (spawn subprocess) ─────────────────────────────

test("assemble.mjs --chunk-plan + --auto-phase0 + --auto-onboard prefill KICKOFF", () => {
  if (!existsSync(join(ROOT, "data.json")) && !existsSync(join(ROOT, "data.public.js"))) return;
  const tempOut = mkdtempSync(join(tmpdir(), "assemble-prefill-test-"));
  const chunkPlanPath = join(tempOut, "chunk-plan.json");
  const phase0Path = join(tempOut, "phase0.json");
  writeFileSync(
    chunkPlanPath,
    JSON.stringify([
      {
        name: "Implement CLI prefill",
        dependsOn: [],
        skills: ["/harness-engineering"],
        done: "Generated KICKOFF includes prefilled Phase 0.",
      },
      {
        name: "Verify package",
        dependsOn: [1],
        done: "ZIP can be parsed and inspected.",
      },
    ])
  );
  writeFileSync(
    phase0Path,
    JSON.stringify({
      restatement: "Prefill onboarding and Phase 0 from operator-supplied JSON.",
      skillScan: "perfect-fit",
      dod: {
        acceptanceCriteria: ["Phase 0 has concrete criteria"],
        verification: "Parse KICKOFF.md from ZIP",
        directlyUsable: "node assemble.mjs --auto-phase0 phase0.json",
      },
      signedBy: "operator-prefill",
      timestamp: "2026-04-25T12:34:56.000Z",
    })
  );

  try {
    const r = spawnSync(
      process.execPath,
      [
        ASSEMBLE,
        "--goal",
        "build agent onboarding prefill",
        "--tier",
        "production",
        "--limit",
        "4",
        "--auto",
        "--chunk-plan",
        chunkPlanPath,
        "--auto-phase0",
        phase0Path,
        "--auto-onboard",
        "--out",
        tempOut,
      ],
      { encoding: "utf-8", timeout: 30_000 }
    );
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}. stderr: ${r.stderr}`);
    assert.match(r.stdout, /Chunk plan: 2 chunk/);
    assert.match(r.stdout, /Phase 0 prefill: signed by operator-prefill/);
    assert.match(r.stdout, /Auto-onboarding banner enabled/);

    const zipFiles = readdirSync(tempOut).filter((f) => f.endsWith(".zip"));
    const zipBytes = readFileSync(join(tempOut, zipFiles[0]));
    const files = parseStoreZip(new Uint8Array(zipBytes));
    const kickoff = new TextDecoder().decode(files.find((f) => f.name === "KICKOFF.md").data);
    assert.match(kickoff, /Pre-onboarding \(operator-confirmed\)/);
    assert.match(kickoff, /PRE-FILLED by operator/);
    assert.match(kickoff, /Your restatement: \*\*Prefill onboarding and Phase 0/);
    assert.match(kickoff, /- \[x\] \*\*Perfect-fit:\*\*/);
    assert.match(kickoff, /## Chunk Plan \(logical-order DAG\)/);
    assert.match(kickoff, /### C1 . Implement CLI prefill/);
    assert.match(kickoff, /\*\*Depends on:\*\* C1/);
    assert.match(kickoff, /_Signed by: \*\*operator-prefill\*\*_/);
  } finally {
    rmSync(tempOut, { recursive: true, force: true });
  }
});

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

// ─── Phase C: auto-skill-dev trigger from prefill.skillScan ───────────────

test("buildPhase0Block injects auto-skill-dev block when skillScan='miss'", () => {
  const md = buildPhase0Block({
    goal: "g",
    tier: "mvp",
    prefill: { skillScan: "miss" },
  });
  assert.match(md, /Auto-triggered for this package/);
  assert.match(md, /\bmiss\b/);
  assert.match(md, /claude \/plugin-dev:skill-development/);
});

test("buildPhase0Block injects auto-skill-dev block when skillScan='partial'", () => {
  const md = buildPhase0Block({
    goal: "g",
    tier: "mvp",
    prefill: { skillScan: "partial" },
  });
  assert.match(md, /Auto-triggered for this package/);
  assert.match(md, /\bpartial\b/);
});

test("buildPhase0Block does NOT inject auto-skill-dev block when skillScan='perfect-fit'", () => {
  const md = buildPhase0Block({
    goal: "g",
    tier: "mvp",
    prefill: { skillScan: "perfect-fit" },
  });
  assert.doesNotMatch(md, /Auto-triggered for this package/);
});

// ─── Phase D: EVAL LOOP block carries concrete debate.mjs invocation ──────

test("buildEvalLoopBlock includes concrete factory/v2-personas debate command", () => {
  const md = buildEvalLoopBlock({ tier: "production" });
  assert.match(md, /Live debate substrate \(preferred\)/);
  assert.match(md, /node factory\/v2-personas\/debate\.mjs/);
  assert.match(md, /operator-ask\.config\.json/);
});

// ─── Phase B: --debate flag → buildDebateBlock + bundling ─────────────────

test("buildDebateBlock returns empty string when topic is missing or blank", () => {
  assert.equal(buildDebateBlock({}), "");
  assert.equal(buildDebateBlock({ topic: "" }), "");
  assert.equal(buildDebateBlock({ topic: "   " }), "");
});

test("buildDebateBlock renders Pre-decision Debate section with the topic", () => {
  const md = buildDebateBlock({ topic: "SemVer or CalVer for releases?" });
  assert.match(md, /## Pre-decision Debate/);
  assert.match(md, /SemVer or CalVer for releases\?/);
  assert.match(md, /node factory\/v2-personas\/debate\.mjs/);
});

test("buildKickoffWithPhase0 inserts debate block before Compound when debateTopic is set", () => {
  const k = buildKickoffWithPhase0({
    goal: "g",
    packageName: "p",
    nodes: [],
    tier: "mvp",
    debateTopic: "Pick a release cadence",
  });
  assert.match(k, /## Pre-decision Debate/);
  const debateIdx = k.indexOf("## Pre-decision Debate");
  const compoundIdx = k.indexOf("## Compound Mechanisms");
  assert.ok(debateIdx > 0, "debate block present");
  assert.ok(compoundIdx > debateIdx, "debate appears before Compound block");
});

test("assemble.mjs --debate bundles factory/v2-personas/ and emits debate block", () => {
  const tempOut = mkdtempSync(join(tmpdir(), "assemble-debate-"));
  try {
    const r = spawnSync(
      process.execPath,
      [
        ASSEMBLE,
        "--goal",
        "demo debate flow",
        "--tier",
        "mvp",
        "--limit",
        "3",
        "--auto",
        "--debate",
        "Should we adopt SemVer or CalVer?",
        "--out",
        tempOut,
      ],
      { encoding: "utf-8", timeout: 30_000 }
    );
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}. stderr: ${r.stderr}`);
    const zipFiles = readdirSync(tempOut).filter((f) => f.endsWith(".zip"));
    assert.ok(zipFiles.length, "expected a .zip output");
    const zipBytes = readFileSync(join(tempOut, zipFiles[0]));
    const files = parseStoreZip(new Uint8Array(zipBytes));

    const kickoff = new TextDecoder().decode(
      files.find((f) => f.name === "KICKOFF.md").data
    );
    assert.match(kickoff, /## Pre-decision Debate/);
    assert.match(kickoff, /Should we adopt SemVer or CalVer\?/);

    const personaFiles = files.filter((f) => f.name.startsWith("factory/v2-personas/"));
    assert.ok(personaFiles.length >= 5, `expected ≥5 persona files bundled, got ${personaFiles.length}`);
    assert.ok(
      personaFiles.some((f) => f.name === "factory/v2-personas/debate.mjs"),
      "debate.mjs must be in the bundled package"
    );
  } finally {
    rmSync(tempOut, { recursive: true, force: true });
  }
});
