// tests/routine-runner.test.mjs — exercises routine-run.mjs with synthetic steps.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runStep, applyVerify, runRoutine } from "../routine-run.mjs";

function makeRunDir() {
  return mkdtempSync(join(tmpdir(), "routine-run-test-"));
}

// ─── runStep: prompt-only path for skill/command ──────────────────────────

test("runStep: skill writes prompt artifact without spawning anything", () => {
  const runDir = makeRunDir();
  try {
    const step = { id: "review", kind: "skill", ref: "/x:reviewer" };
    const r = runStep(step, {}, { runDir });
    assert.equal(r.ok, true);
    assert.equal(r.decision, "prompt-written");
    assert.ok(existsSync(r.detail.path), "prompt file should exist");
    const body = readFileSync(r.detail.path, "utf-8");
    assert.match(body, /\/x:reviewer/);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

// ─── runStep: shell safety grind ──────────────────────────────────────────

test("runStep: shell step blocked without runtime_authorized even with --execute", () => {
  const runDir = makeRunDir();
  try {
    const step = { id: "danger", kind: "shell", ref: "echo unsafe" };
    const r = runStep(step, {}, { runDir, execute: true });
    assert.equal(r.ok, false);
    assert.equal(r.decision, "blocked");
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("runStep: shell step dry-run does NOT execute", () => {
  const runDir = makeRunDir();
  try {
    const step = { id: "echo", kind: "shell", ref: "echo hi", args: { runtime_authorized: true } };
    const r = runStep(step, {}, { runDir, execute: false });
    assert.equal(r.ok, true);
    assert.equal(r.decision, "dry-run");
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("runStep: shell with runtime_authorized=true AND --execute runs the command", () => {
  const runDir = makeRunDir();
  try {
    // 'node -e' is cross-platform unlike 'echo'
    // Quote process.execPath for Windows cmd compatibility (path may contain spaces).
    const step = {
      id: "node-echo",
      kind: "shell",
      ref: `"${process.execPath}" -e "console.log('hello')"`,
      args: { runtime_authorized: true },
    };
    const r = runStep(step, {}, { runDir, execute: true });
    assert.equal(r.ok, true, `expected ok, got ${JSON.stringify(r)}`);
    assert.equal(r.decision, "executed");
    assert.match(r.detail.stdout_head, /hello/);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

// ─── applyVerify ──────────────────────────────────────────────────────────

test("applyVerify: no verify block returns ok", () => {
  const r = applyVerify({}, {});
  assert.equal(r.ok, true);
  assert.equal(r.detail.skipped, true);
});

test("applyVerify: artifact verify fails when path is missing", () => {
  const r = applyVerify({ verify: { kind: "artifact", path: "/no/such/path/nope.md" } }, {});
  assert.equal(r.ok, false);
  assert.equal(r.detail.missing, "/no/such/path/nope.md");
});

test("applyVerify: artifact verify passes when path exists", () => {
  const runDir = makeRunDir();
  try {
    const filePath = join(runDir, "exists.md");
    writeFileSync(filePath, "ok");
    const r = applyVerify({ verify: { kind: "artifact", path: filePath } }, {});
    assert.equal(r.ok, true);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("applyVerify: manual verify always passes (runner trusts the operator)", () => {
  const r = applyVerify({ verify: { kind: "manual" } }, {});
  assert.equal(r.ok, true);
});

test("applyVerify: command verify in dry-run does not spawn", () => {
  const r = applyVerify({ verify: { kind: "command", command: "exit 1" } }, { execute: false });
  assert.equal(r.ok, true);
  assert.match(r.detail.dry_run_verify || "", /exit/);
});

// ─── runRoutine: end-to-end synthetic ────────────────────────────────────

test("runRoutine: dry-run on multi-kind synthetic routine returns ok and writes JSONL log", () => {
  const runDir = makeRunDir();
  try {
    const routine = {
      version: 1,
      id: "synthetic-dry",
      title: "Synthetic dry-run",
      cadence: "manual",
      steps: [
        { id: "s1", kind: "skill", ref: "/x" },
        { id: "s2", kind: "shell", ref: "echo would-run" },
        { id: "s3", kind: "assemble", ref: "do something safe" },
      ],
    };
    const result = runRoutine(routine, { execute: false, runDir });
    assert.equal(result.ok, true);
    assert.equal(result.failedAt, null);
    assert.equal(result.results.length, 3);
    assert.equal(result.results[0].step_decision, "prompt-written");
    assert.equal(result.results[1].step_decision, "dry-run");
    assert.equal(result.results[2].step_decision, "dry-run");
    const log = readFileSync(join(runDir, "synthetic-dry.jsonl"), "utf-8");
    const lines = log.trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines[0].event, "start");
    assert.equal(lines[lines.length - 1].event, "end");
    assert.ok(lines.some((l) => l.event === "step"));
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("runRoutine: halts on first failure when on_failure is escalate (default)", () => {
  const runDir = makeRunDir();
  try {
    const routine = {
      version: 1,
      id: "synthetic-halt",
      title: "Halt test",
      cadence: "manual",
      steps: [
        { id: "ok", kind: "skill", ref: "/x" },
        { id: "bad", kind: "skill", ref: "/y", verify: { kind: "artifact", path: "/nope/never.md" } },
        { id: "never-reached", kind: "skill", ref: "/z" },
      ],
    };
    const result = runRoutine(routine, { execute: false, runDir });
    assert.equal(result.ok, false);
    assert.equal(result.failedAt, 1);
    assert.equal(result.results.length, 2, "should stop after the failing step");
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("runRoutine: continues past failure when on_failure=continue", () => {
  const runDir = makeRunDir();
  try {
    const routine = {
      version: 1,
      id: "synthetic-continue",
      title: "Continue test",
      cadence: "manual",
      steps: [
        { id: "bad", kind: "skill", ref: "/y", verify: { kind: "artifact", path: "/nope/never.md" }, on_failure: "continue" },
        { id: "after", kind: "skill", ref: "/z" },
      ],
    };
    const result = runRoutine(routine, { execute: false, runDir });
    assert.equal(result.ok, true, "should reach end despite step 0 failing");
    assert.equal(result.results.length, 2);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});

test("runRoutine: dry-run of on-disk fixture correctly fails artifact verify (assemble didn't actually run)", () => {
  const runDir = makeRunDir();
  try {
    const fixture = JSON.parse(
      readFileSync(new URL("../routines/code-review.routine.json", import.meta.url), "utf-8")
    );
    // The first step is an `assemble` with `verify: artifact KICKOFF.md`.
    // In dry-run the assemble is a no-op, so KICKOFF.md does not appear and
    // the artifact verify correctly fails. This documents that dry-run is
    // honest about what would-have-been vs. what actually exists.
    const result = runRoutine(fixture, { execute: false, runDir });
    assert.equal(result.ok, false, "artifact verify should fail when the produced file does not exist");
    assert.equal(result.failedAt, 0);
    assert.equal(result.results[0].step_decision, "dry-run");
    assert.equal(result.results[0].verify_ok, false);
  } finally {
    rmSync(runDir, { recursive: true, force: true });
  }
});
