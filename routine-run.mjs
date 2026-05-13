#!/usr/bin/env node
// routine-run.mjs — sequential routine.v1 runner.
//
// Defaults to dry-run. To execute side-effects, pass --execute.
// Even with --execute, skill/command steps NEVER spawn Claude — they emit a
// prompt artifact and the human (or downstream agent) decides what to do.
// shell steps run only when the step has `args.runtime_authorized: true` AND
// --execute is set. assemble steps shell out to `node assemble.mjs`.
//
// Log format: one JSONL line per step decision, written under
// `.agents/routine-runs/<ts>/<routine-id>.jsonl`. Exit code = 0 on success,
// = (step_index + 1) on first failure (so it's easy to see which step failed).

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, appendFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KB_PROVIDERS = new Set(["file", "portable-kit", "http"]);
const KB_PROVIDERS_IMPLEMENTED = new Set(["file"]);
const KB_DEFAULT_LIMIT = 32_000;

import { loadRoutine } from "./lib/routine.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { routinePath: null, execute: false, runDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--execute") out.execute = true;
    else if (a === "--dry-run") out.execute = false;
    else if (a === "--run-dir") out.runDir = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else if (!out.routinePath) out.routinePath = a;
  }
  return out;
}

function helpText() {
  return [
    "Usage: node routine-run.mjs <routine.json> [--execute] [--run-dir <path>]",
    "",
    "  --execute       run shell/assemble/handoff steps (default: dry-run)",
    "  --run-dir DIR   write log + step artifacts under DIR (default: .agents/routine-runs/<ts>)",
    "",
    "Step kinds:",
    "  skill / command — write a prompt artifact only (never auto-invoke Claude)",
    "  shell           — spawnSync only when step.args.runtime_authorized=true AND --execute",
    "  assemble        — shells out to `node assemble.mjs --goal <ref> --auto --tier <args.tier>`",
    "  handoff         — shells out to `node handoff-bridge.mjs <args>`",
    "",
    "Exit code: 0 = all steps reached an OK or skip decision; N>0 = first failing step index+1",
  ].join("\n");
}

function isoStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Append a JSONL log line under runDir/<routine-id>.jsonl
function logLine(runDir, routineId, record) {
  const path = join(runDir, `${routineId}.jsonl`);
  appendFileSync(path, JSON.stringify(record) + "\n");
}

// Execute a single step. Returns { ok, decision, detail }.
export function runStep(step, ctx, { execute = false, runDir, runtimeAuthorized = false } = {}) {
  const stepId = step.id || step.kind;

  if (step.kind === "skill" || step.kind === "command") {
    const promptPath = join(runDir, `${stepId}.prompt.md`);
    const body = [
      `# Step: ${stepId}`,
      "",
      `Kind: \`${step.kind}\`  •  Ref: \`${step.ref}\``,
      "",
      step.args ? `## Args\n\n\`\`\`json\n${JSON.stringify(step.args, null, 2)}\n\`\`\`` : "",
      "",
      "## Invocation",
      "",
      `Paste this into a Claude session: \`${step.ref}\``,
    ].join("\n");
    writeFileSync(promptPath, body);
    return { ok: true, decision: "prompt-written", detail: { path: promptPath } };
  }

  if (step.kind === "shell") {
    if (!execute) return { ok: true, decision: "dry-run", detail: { would_run: step.ref } };
    if (!runtimeAuthorized && !(step.args && step.args.runtime_authorized === true)) {
      return { ok: false, decision: "blocked", detail: { reason: "shell step requires step.args.runtime_authorized=true" } };
    }
    const r = spawnSync(step.ref, { shell: true, encoding: "utf-8" });
    return r.status === 0
      ? { ok: true, decision: "executed", detail: { stdout_head: (r.stdout || "").slice(0, 200) } }
      : { ok: false, decision: "failed", detail: { status: r.status, stderr_head: (r.stderr || "").slice(0, 400) } };
  }

  if (step.kind === "assemble") {
    if (!execute) return { ok: true, decision: "dry-run", detail: { would_assemble: step.ref } };
    const cliArgs = ["assemble.mjs", "--goal", step.ref, "--auto"];
    if (step.args?.tier) cliArgs.push("--tier", step.args.tier);
    if (typeof step.args?.limit === "number") cliArgs.push("--limit", String(step.args.limit));
    if (step.args?.scenarioGate) cliArgs.push("--scenario-gate", step.args.scenarioGate);
    if (step.args?.outDir) cliArgs.push("--out", step.args.outDir);
    const r = spawnSync(process.execPath, cliArgs, { cwd: __dirname, encoding: "utf-8", timeout: 60_000 });
    return r.status === 0
      ? { ok: true, decision: "executed", detail: { tail: (r.stdout || "").slice(-200) } }
      : { ok: false, decision: "failed", detail: { status: r.status, stderr_head: (r.stderr || "").slice(0, 400) } };
  }

  if (step.kind === "handoff") {
    if (!execute) return { ok: true, decision: "dry-run", detail: { would_handoff: step.ref } };
    const r = spawnSync(process.execPath, ["handoff-bridge.mjs", step.ref], { cwd: __dirname, encoding: "utf-8", timeout: 30_000 });
    return r.status === 0
      ? { ok: true, decision: "executed", detail: { tail: (r.stdout || "").slice(-200) } }
      : { ok: false, decision: "failed", detail: { status: r.status, stderr_head: (r.stderr || "").slice(0, 400) } };
  }

  if (step.kind === "kb_query") {
    const provider = step.args?.provider || "file";
    if (!KB_PROVIDERS.has(provider)) {
      return { ok: false, decision: "kb-bad-provider", detail: { provider, allowed: [...KB_PROVIDERS] } };
    }
    if (!KB_PROVIDERS_IMPLEMENTED.has(provider)) {
      return {
        ok: false,
        decision: "kb-not-implemented",
        detail: {
          provider,
          note: "v1 implements only `file`. portable-kit / http are reserved contract slots — operator must wire them per environment.",
        },
      };
    }
    const targetPath = step.args?.path || step.ref;
    if (typeof targetPath !== "string" || targetPath.length === 0) {
      return { ok: false, decision: "kb-missing-path", detail: { reason: "kb_query.args.path or step.ref required" } };
    }
    if (!execute) {
      return {
        ok: true,
        decision: "dry-run",
        detail: { would_read: targetPath, provider, limit: step.args?.limit || KB_DEFAULT_LIMIT },
      };
    }
    if (!existsSync(targetPath)) {
      return { ok: false, decision: "kb-missing-file", detail: { path: targetPath } };
    }
    const raw = readFileSync(targetPath, "utf-8");
    const limit = typeof step.args?.limit === "number" ? step.args.limit : KB_DEFAULT_LIMIT;
    const snippet = raw.length > limit ? raw.slice(0, limit) + "\n\n... [truncated]" : raw;
    const outPath = join(runDir, `${stepId}.kb.md`);
    const labelPrefix = step.args?.output_prefix ? `# ${step.args.output_prefix}\n\n` : "";
    writeFileSync(
      outPath,
      labelPrefix +
        `Source: \`${targetPath}\` (provider: ${provider})\n` +
        `Bytes read: ${raw.length}; included: ${snippet.length}\n\n` +
        "---\n\n" +
        snippet
    );
    return { ok: true, decision: "kb-read", detail: { path: outPath, bytes_included: snippet.length, source: targetPath } };
  }

  return { ok: false, decision: "unknown-kind", detail: { kind: step.kind } };
}

// Apply a step's `verify` block. Returns { ok, detail }.
export function applyVerify(step, { execute = false } = {}) {
  if (!step.verify) return { ok: true, detail: { skipped: true } };
  const v = step.verify;
  if (v.kind === "manual") return { ok: true, detail: { manual: true } };
  if (v.kind === "artifact") {
    return existsSync(v.path)
      ? { ok: true, detail: { exists: v.path } }
      : { ok: false, detail: { missing: v.path } };
  }
  if (v.kind === "exit_zero" || v.kind === "command") {
    if (!execute) return { ok: true, detail: { dry_run_verify: v.command || "(exit_zero)" } };
    const cmd = v.command;
    if (typeof cmd !== "string") return { ok: false, detail: { reason: "verify.command missing" } };
    const r = spawnSync(cmd, { shell: true, encoding: "utf-8" });
    if (r.status !== 0) return { ok: false, detail: { status: r.status, stderr_head: (r.stderr || "").slice(0, 300) } };
    if (v.expected_pattern) {
      const re = new RegExp(v.expected_pattern);
      if (!re.test(r.stdout || "")) {
        return { ok: false, detail: { reason: "expected_pattern did not match", pattern: v.expected_pattern } };
      }
    }
    return { ok: true, detail: { exit: 0 } };
  }
  return { ok: false, detail: { reason: `unknown verify.kind=${v.kind}` } };
}

export function runRoutine(routine, { execute = false, runDir } = {}) {
  if (!runDir) runDir = join(__dirname, ".agents", "routine-runs", isoStamp());
  mkdirSync(runDir, { recursive: true });
  const results = [];
  logLine(runDir, routine.id, { ts: new Date().toISOString(), event: "start", id: routine.id, execute });

  for (let i = 0; i < routine.steps.length; i++) {
    const step = routine.steps[i];
    const stepResult = runStep(step, { routine }, { execute, runDir });
    let verifyResult = { ok: true, detail: { skipped: true } };
    if (stepResult.ok) verifyResult = applyVerify(step, { execute });
    const combined = {
      index: i,
      id: step.id || `step-${i}`,
      kind: step.kind,
      ref: step.ref,
      ok: stepResult.ok && verifyResult.ok,
      step_decision: stepResult.decision,
      step_detail: stepResult.detail,
      verify_ok: verifyResult.ok,
      verify_detail: verifyResult.detail,
    };
    logLine(runDir, routine.id, { ts: new Date().toISOString(), event: "step", ...combined });
    results.push(combined);
    if (!combined.ok) {
      const onFailure = step.on_failure || "escalate";
      if (onFailure === "continue") continue;
      logLine(runDir, routine.id, { ts: new Date().toISOString(), event: "halt", index: i, mode: onFailure });
      return { ok: false, runDir, results, failedAt: i };
    }
  }

  logLine(runDir, routine.id, { ts: new Date().toISOString(), event: "end", ok: true });
  return { ok: true, runDir, results, failedAt: null };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.routinePath) {
    console.log(helpText());
    process.exit(args.help ? 0 : 1);
  }
  let routine;
  try {
    routine = loadRoutine(resolve(args.routinePath));
  } catch (err) {
    console.error("Failed to load routine:", err.message);
    process.exit(2);
  }

  const result = runRoutine(routine, { execute: args.execute, runDir: args.runDir });
  console.log(`Routine ${routine.id}: ${result.ok ? "ok" : "FAILED at step " + result.failedAt}`);
  console.log(`Log: ${result.runDir}`);
  for (const r of result.results) {
    const mark = r.ok ? "OK" : "X";
    console.log(`  ${mark} [${r.index}] ${r.id} (${r.kind}) -> ${r.step_decision}`);
  }
  process.exit(result.ok ? 0 : (result.failedAt + 1));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
