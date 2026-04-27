// Tests for .agents/task.mjs — Compound Protocol task ledger CLI
// Run: node --test tests/agents-task.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const CLI = join(REPO_ROOT, ".agents", "task.mjs");

function freshLedger() {
  const dir = mkdtempSync(join(tmpdir(), "compound-test-"));
  const ledger = join(dir, "TASKS.json");
  writeFileSync(
    ledger,
    JSON.stringify(
      { version: "1", schema_url: ".agents/PROTOCOL.md", current: null, tasks: [], agents_active: [], log: [] },
      null,
      2
    )
  );
  return { dir, ledger };
}

function run(ledger, args, extraEnv = {}) {
  return spawnSync("node", [CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, COMPOUND_TASKS_PATH: ledger, ...extraEnv },
  });
}

const readLedger = (path) => JSON.parse(readFileSync(path, "utf-8"));

test("status on empty ledger", () => {
  const { ledger, dir } = freshLedger();
  try {
    const r = run(ledger, ["status"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /No current task/);
    assert.match(r.stdout, /Total: 0/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("ack records agent identity", () => {
  const { ledger, dir } = freshLedger();
  try {
    const r = run(ledger, ["ack", "claude-test"]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.deepEqual(data.agents_active, ["claude-test"]);
    assert.equal(data.log[0].event, "ack");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("open requires --dod or --qa", () => {
  const { ledger, dir } = freshLedger();
  try {
    const r = run(ledger, ["open", "test goal"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /requires at least one --dod/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("open creates task with DoD and skill", () => {
  const { ledger, dir } = freshLedger();
  try {
    const r = run(ledger, ["open", "test goal", "--dod", "test:echo ok", "--skill", "tdd"]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].state, "in_progress");
    assert.equal(data.tasks[0].dod[0].check, "test");
    assert.equal(data.tasks[0].dod[0].command, "echo ok");
    assert.deepEqual(data.tasks[0].skills, ["tdd"]);
    assert.equal(data.current, data.tasks[0].id);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("open refuses second task while first in_progress", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "first", "--dod", "test:echo ok"]);
    const r = run(ledger, ["open", "second", "--dod", "test:echo ok"]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Park or finish it first/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("park then resume", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "first", "--dod", "test:echo ok"]);
    const id = readLedger(ledger).current;
    let r = run(ledger, ["park", id, "--reason", "switching to urgent fix"]);
    assert.equal(r.status, 0, r.stderr);
    let data = readLedger(ledger);
    assert.equal(data.tasks[0].state, "parked");
    assert.equal(data.current, null);
    r = run(ledger, ["resume", id]);
    assert.equal(r.status, 0, r.stderr);
    data = readLedger(ledger);
    assert.equal(data.tasks[0].state, "in_progress");
    assert.equal(data.current, id);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("verify passes test+artifact, marks passed_at", () => {
  const { ledger, dir } = freshLedger();
  try {
    const probe = join(dir, "probe.txt");
    writeFileSync(probe, "hello world buildr");
    run(ledger, [
      "open", "verify-test",
      "--dod", "test:node -e \"process.exit(0)\"",
      "--dod", `artifact:${probe}`,
    ]);
    const id = readLedger(ledger).current;
    const r = run(ledger, ["verify", id]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.ok(data.tasks[0].dod[0].passed_at, "test passed_at should be set");
    assert.ok(data.tasks[0].dod[1].passed_at, "artifact passed_at should be set");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("verify fails on missing artifact", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "fail-test", "--dod", "artifact:/nonexistent/path"]);
    const id = readLedger(ledger).current;
    const r = run(ledger, ["verify", id]);
    assert.notEqual(r.status, 0);
    const data = readLedger(ledger);
    assert.equal(data.tasks[0].dod[0].passed_at, null);
    assert.ok(data.tasks[0].dod[0].last_failure);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("done refuses with unverified DoD", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "done-test", "--dod", "test:echo ok"]);
    const id = readLedger(ledger).current;
    const r = run(ledger, ["done", id]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /DoD checks have not passed/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("done succeeds after verify", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "happy-path", "--dod", "test:node -e \"process.exit(0)\""]);
    const id = readLedger(ledger).current;
    let r = run(ledger, ["verify", id]);
    assert.equal(r.status, 0, r.stderr);
    r = run(ledger, ["done", id]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.equal(data.tasks[0].state, "done");
    assert.equal(data.current, null);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("block records unlock_command", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "block-test", "--dod", "test:echo ok"]);
    const id = readLedger(ledger).current;
    const r = run(ledger, ["block", id, "--reason", "waiting on review", "--unlock", "git pr review"]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.equal(data.tasks[0].state, "blocked");
    assert.equal(data.tasks[0].unlock_command, "git pr review");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("import reads frontmatter and creates tasks (--apply)", () => {
  const { ledger, dir } = freshLedger();
  try {
    const plan = join(dir, "plan.md");
    writeFileSync(
      plan,
      [
        "---",
        "compound: active",
        "phases:",
        "  - id: phase-1",
        "    goal: \"first phase\"",
        "    dod:",
        "      - check: test",
        "        command: \"echo ok\"",
        "    skills:",
        "      - \"tdd-workflow\"",
        "---",
        "",
        "# plan body",
      ].join("\n")
    );
    const r = run(ledger, ["import", plan, "--apply"]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].id, "phase-1");
    assert.equal(data.tasks[0].state, "open");
    assert.equal(data.tasks[0].dod[0].command, "echo ok");
    assert.deepEqual(data.tasks[0].skills, ["tdd-workflow"]);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("import inline markers", () => {
  const { ledger, dir } = freshLedger();
  try {
    const plan = join(dir, "plan.md");
    writeFileSync(
      plan,
      [
        "<!-- COMPOUND: active -->",
        "# Plan",
        "[COMPOUND-PHASE id=p1 goal=\"build foo\" dod=\"test:npm test;artifact:dist/foo.html\" skills=\"frontend-patterns\"]",
        "Body.",
      ].join("\n")
    );
    const r = run(ledger, ["import", plan, "--apply"]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.equal(data.tasks.length, 1);
    assert.equal(data.tasks[0].id, "p1");
    assert.equal(data.tasks[0].dod.length, 2);
    assert.equal(data.tasks[0].skills[0], "frontend-patterns");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("import dry-run does not write", () => {
  const { ledger, dir } = freshLedger();
  try {
    const plan = join(dir, "plan.md");
    writeFileSync(
      plan,
      [
        "---",
        "compound: active",
        "phases:",
        "  - id: dryrun",
        "    goal: \"x\"",
        "    dod:",
        "      - check: test",
        "        command: \"echo ok\"",
        "---",
      ].join("\n")
    );
    const r = run(ledger, ["import", plan]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Dry-run/);
    const data = readLedger(ledger);
    assert.equal(data.tasks.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("import skips plans without compound:active marker", () => {
  const { ledger, dir } = freshLedger();
  try {
    const plan = join(dir, "plan.md");
    writeFileSync(plan, "# just a plan\n[COMPOUND-PHASE id=ignored goal=\"x\" dod=\"test:echo ok\"]\n");
    const r = run(ledger, ["import", plan, "--apply"]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /not marked compound:active/);
    const data = readLedger(ledger);
    assert.equal(data.tasks.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("update adds skill and dod", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "u-test", "--dod", "test:echo ok"]);
    const id = readLedger(ledger).current;
    const r = run(ledger, ["update", id, "--skill", "added-skill", "--dod", "manual:user confirms"]);
    assert.equal(r.status, 0, r.stderr);
    const data = readLedger(ledger);
    assert.deepEqual(data.tasks[0].skills, ["added-skill"]);
    assert.equal(data.tasks[0].dod.length, 2);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("hook session-start emits JSON additionalContext", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "hook-test", "--dod", "test:echo ok"]);
    const r = run(ledger, ["hook", "session-start"]);
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.hookSpecificOutput);
    assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
    assert.match(parsed.hookSpecificOutput.additionalContext, /Current task/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("hook pre-edit warns when no task in WARN mode", () => {
  const { ledger, dir } = freshLedger();
  try {
    const r = run(ledger, ["hook", "pre-edit"]);
    assert.equal(r.status, 0, r.stderr);
    const parsed = JSON.parse(r.stdout);
    assert.match(parsed.hookSpecificOutput.additionalContext, /No in_progress task/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("hook pre-edit allows when task in_progress", () => {
  const { ledger, dir } = freshLedger();
  try {
    run(ledger, ["open", "hook-progress", "--dod", "test:echo ok"]);
    const r = run(ledger, ["hook", "pre-edit"]);
    assert.equal(r.status, 0, r.stderr);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("hook pre-edit blocks in ENFORCE mode without task", () => {
  const { ledger, dir } = freshLedger();
  try {
    const r = run(ledger, ["hook", "pre-edit"], { COMPOUND_ENFORCE: "1" });
    assert.equal(r.status, 2, "should exit 2 in enforce mode");
    assert.match(r.stderr, /No in_progress task/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
