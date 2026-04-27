import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildResumePrompt,
  loadHandoff,
  writeCheckpoint,
} from "../handoff-bridge.mjs";

const dir = mkdtempSync(join(tmpdir(), "handoff-roundtrip-"));
const ledgerPath = join(dir, "TASKS.json");

try {
  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        version: "1",
        schema_url: ".agents/PROTOCOL.md",
        current: "t-001",
        agents_active: ["codex-gpt-5-codex"],
        log: [],
        tasks: [
          {
            id: "t-001",
            goal: "Live Handoff Bridge v1",
            state: "in_progress",
            skills: ["agent-framework", "harness-engineering", "memory-systems", "advanced-evaluation"],
            dod: [
              { check: "artifact", path: "handoff-bridge.mjs", passed_at: null },
              { check: "test", command: "node --test tests/handoff-bridge.test.mjs", passed_at: null },
            ],
            updated_at: "2026-04-27T19:00:00.000Z",
          },
        ],
      },
      null,
      2
    )
  );

  const codexToClaude = writeCheckpoint({
    cwd: dir,
    ledgerPath,
    taskId: "t-001",
    to: "claude",
    from: "codex-gpt-5-codex",
    runtime: "codex",
    trigger: "manual",
    summary: "Codex created the contract shape and is asking Claude to continue implementation.",
    completed: ["Ledger task opened", "Contract fields selected", "Manual trigger chosen for v1"],
    pending: ["Implement bridge CLI", "Add roundtrip simulation", "Run DoD tests"],
    files: ["handoff-bridge.mjs", "schemas/handoff-contract.v1.json"],
    decisions: ["Schema stays format-agnostic; target prompt is Claude first."],
    risks: ["Token trigger is enum-only in v1."],
    verification: ["No tests have passed yet"],
    out: "handoffs/codex-to-claude.json",
    createdAt: "2026-04-27T19:10:00.000Z",
  });
  const claudePrompt = buildResumePrompt(codexToClaude.contract, { target: "claude" });
  assert.match(claudePrompt, /Implement bridge CLI/);
  assert.match(claudePrompt, /Manual trigger chosen for v1/);

  const claudeToCodex = writeCheckpoint({
    cwd: dir,
    ledgerPath,
    taskId: "t-001",
    to: "codex",
    from: "claude-opus-4.7",
    runtime: "claude",
    trigger: "stop-mid-task",
    reason: "simulated context boundary",
    summary: "Claude completed the CLI and returns verification work to Codex.",
    completed: [
      ...codexToClaude.contract.completed,
      "Bridge CLI implemented",
      "Resume prompt generated",
    ],
    pending: ["Run final DoD checks", "Ask Robin for manual roundtrip confirmation"],
    files: ["handoff-bridge.mjs", "tests/handoff-bridge.test.mjs", "tests/handoff-roundtrip-sim.mjs"],
    decisions: [...codexToClaude.contract.decisions, "Ledger stores handoff pointers on task.handoffs."],
    risks: ["Manual confirmation remains human-only."],
    verification: ["Roundtrip simulation constructed"],
    out: "handoffs/claude-to-codex.json",
    createdAt: "2026-04-27T19:20:00.000Z",
  });

  const returned = loadHandoff(claudeToCodex.outPath, dir);
  const codexPrompt = buildResumePrompt(returned, { target: "codex" });
  assert.match(codexPrompt, /Run final DoD checks/);
  assert.match(codexPrompt, /Bridge CLI implemented/);

  const ledger = JSON.parse(readFileSync(ledgerPath, "utf-8"));
  assert.equal(ledger.tasks[0].handoffs.length, 2);
  assert.equal(ledger.tasks[0].last_handoff.to, "codex");
  assert.equal(ledger.log.filter((entry) => entry.event === "handoff-checkpoint").length, 2);

  console.log("handoff-roundtrip-sim: Codex -> Claude -> Codex passed");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
