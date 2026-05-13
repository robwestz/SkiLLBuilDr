// tests/factory-e2e.test.mjs — end-to-end roundtrip for the Agentic Factory v1.
// Exercises: rank_skills_for_goal -> assemble_from_goal -> routine-run dry-run.
// The point is to prove the three new surfaces produced in Fas 0-6 actually
// compose into a single pipeline, with no manual orchestration in between.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { handleToolCall } from "../mcp-server.mjs";
import { parseStoreZip } from "../zip-builder.mjs";
import { runRoutine } from "../routine-run.mjs";
import { validateRoutine } from "../lib/routine.mjs";

const CATALOG = [
  { slug: "/ecc:python-reviewer", name: "python-reviewer", description: "Reviews Python code for quality", category: "Review", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/ecc:tdd-guide", name: "tdd-guide", description: "Test-driven development guide", category: "Testing", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/ecc:security-reviewer", name: "security-reviewer", description: "Security vulnerability detection and remediation", category: "Security", type: "skill", source: "plugin:everything-claude-code" },
  { slug: "/ecc:planner", name: "planner", description: "Planning complex features and tasks", category: "Planning", type: "skill", source: "plugin:everything-claude-code" },
];

test("E2E: rank -> assemble_from_goal -> routine-run dry-run completes without external state", () => {
  const goal = "review python code for security and tests";

  // 1) Rank the catalog locally (proves the IDF surface still scores the goal sensibly).
  const ranking = handleToolCall("rank_skills_for_goal", { goal, limit: 4 }, CATALOG);
  assert.ok(!ranking.error, `rank error: ${ranking.error?.message}`);
  const ranked = JSON.parse(ranking.content[0].text);
  assert.ok(ranked.length > 0, "ranker should match at least one item against the goal");

  // 2) Assemble a package directly from the goal — this is the Fas 1 one-call path.
  const assembled = handleToolCall(
    "assemble_from_goal",
    { goal, tier: "production", limit: 3 },
    CATALOG
  );
  assert.ok(!assembled.error, `assemble error: ${assembled.error?.message}`);
  const pkg = JSON.parse(assembled.content[0].text);
  assert.ok(typeof pkg.base64zip === "string" && pkg.base64zip.length > 0);
  assert.ok(Array.isArray(pkg.picked) && pkg.picked.length > 0);

  // 3) Decode the ZIP and write it to a temp workspace as if a downstream agent
  //    had extracted the package.
  const workspace = mkdtempSync(join(tmpdir(), "factory-e2e-"));
  try {
    const zipBytes = Buffer.from(pkg.base64zip, "base64");
    const files = parseStoreZip(new Uint8Array(zipBytes));
    for (const f of files) {
      const outPath = join(workspace, f.name);
      writeFileSync(outPath, Buffer.from(f.data));
    }
    const kickoffPath = join(workspace, "KICKOFF.md");
    assert.ok(existsSync(kickoffPath), "KICKOFF.md must exist after extracting the package");
    const kickoff = readFileSync(kickoffPath, "utf-8");
    assert.match(kickoff, /Phase 0 — Preflight Contract/);
    assert.match(kickoff, /Compound Mechanisms/);
    assert.match(kickoff, /Quality Gate/);

    // 4) Build a synthetic routine that points at the extracted KICKOFF.md.
    //    The routine demonstrates the runner can chain a prompt-write step
    //    with an artifact-verify against the assembled package.
    const routine = {
      version: 1,
      id: "e2e-roundtrip",
      title: "E2E roundtrip routine",
      cadence: "manual",
      steps: [
        { id: "review", kind: "skill", ref: pkg.picked[0].slug },
        {
          id: "verify-kickoff",
          kind: "kb_query",
          ref: kickoffPath,
          args: { provider: "file", limit: 2000, output_prefix: "KICKOFF excerpt" },
          verify: { kind: "artifact", path: kickoffPath },
        },
      ],
    };
    const v = validateRoutine(routine);
    assert.equal(v.ok, true, `synthetic routine should be schema-valid: ${v.errors.join("; ")}`);

    // 5) Run the routine in execute mode so we exercise the only safe side
    //    effect — kb_query writing a context artifact. shell steps would be
    //    blocked because we never set runtime_authorized, but this routine
    //    intentionally avoids shell to keep the test deterministic.
    const runDir = join(workspace, "run");
    const result = runRoutine(routine, { execute: true, runDir });
    assert.equal(result.ok, true, `runRoutine failed: ${JSON.stringify(result, null, 2)}`);
    assert.equal(result.results.length, 2);
    assert.equal(result.results[0].step_decision, "prompt-written");
    assert.equal(result.results[1].step_decision, "kb-read");

    // 6) The routine's own log + the kb context artifact should be present.
    assert.ok(existsSync(join(runDir, "review.prompt.md")));
    assert.ok(existsSync(join(runDir, "verify-kickoff.kb.md")));
    const kbBody = readFileSync(join(runDir, "verify-kickoff.kb.md"), "utf-8");
    assert.match(kbBody, /KICKOFF excerpt/);
    assert.match(kbBody, /Phase 0 — Preflight Contract/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
