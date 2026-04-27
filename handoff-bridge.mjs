#!/usr/bin/env node
/**
 * handoff-bridge.mjs
 *
 * Checkpoint/resume bridge between agent sessions. v1 is intentionally explicit:
 * manual trigger first, schema supports token/stop-mid-task for future adapters.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname;
const DEFAULT_LEDGER = ".agents/TASKS.json";
const SCHEMA_VERSION = "handoff-contract.v1";
const TRIGGERS = new Set(["manual", "token", "stop-mid-task"]);
const TARGETS = new Set(["claude", "codex"]);

function nowISO() {
  return new Date().toISOString();
}

function compactTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(text = "handoff") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    || "handoff";
}

function parseArgs(argv) {
  const args = { _: [], completed: [], pending: [], file: [], decision: [], risk: [], command: [], verification: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--completed") args.completed.push(argv[++i] ?? "");
    else if (arg === "--pending") args.pending.push(argv[++i] ?? "");
    else if (arg === "--file") args.file.push(argv[++i] ?? "");
    else if (arg === "--decision") args.decision.push(argv[++i] ?? "");
    else if (arg === "--risk") args.risk.push(argv[++i] ?? "");
    else if (arg === "--command") args.command.push(argv[++i] ?? "");
    else if (arg === "--verification") args.verification.push(argv[++i] ?? "");
    else if (arg.startsWith("--")) args[arg.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else args._.push(arg);
  }
  return args;
}

export function ledgerPathFromEnv(env = process.env, cwd = REPO_ROOT) {
  return resolve(cwd, env.COMPOUND_TASKS_PATH || DEFAULT_LEDGER);
}

export function loadLedger(path = ledgerPathFromEnv()) {
  if (!existsSync(path)) {
    return { version: "1", schema_url: ".agents/PROTOCOL.md", current: null, tasks: [], agents_active: [], log: [] };
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveLedger(ledger, path) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(ledger, null, 2) + "\n");
  renameSync(tmp, path);
}

function normalizeRelativePath(path, cwd = REPO_ROOT) {
  if (!path) return "";
  const resolved = isAbsolute(path) ? path : resolve(cwd, path);
  const rel = relative(cwd, resolved).replace(/\\/g, "/");
  return rel.startsWith("..") ? path.replace(/\\/g, "/") : rel;
}

function hasSecretLikeValue(text) {
  return /(sk-[a-z0-9_-]{12,}|gsk_[a-z0-9_-]{12,}|sbp_[a-z0-9_-]{12,}|api[_-]?key\s*[:=]|password\s*[:=])/i.test(String(text));
}

function hasUserAbsolutePath(text) {
  return /[A-Za-z]:\\Users\\|\/home\/[^/\s]+|\/Users\/[^/\s]+/.test(String(text));
}

function safeList(values = []) {
  return values.map((v) => String(v || "").trim()).filter(Boolean);
}

function taskDodSummary(dod = []) {
  return dod.map((d) => ({
    check: d.check,
    command: d.command,
    path: d.path,
    description: d.description,
    passed_at: d.passed_at || null,
  }));
}

export function findTask(ledger, taskId) {
  const id = taskId || ledger.current;
  return ledger.tasks.find((task) => task.id === id) || null;
}

export function createHandoffContract(options = {}) {
  const cwd = options.cwd ? resolve(options.cwd) : REPO_ROOT;
  const ledgerPath = resolve(cwd, options.ledgerPath || DEFAULT_LEDGER);
  const ledger = options.ledger || loadLedger(ledgerPath);
  const task = options.task || findTask(ledger, options.taskId);
  if (!task) throw new Error("No task found. Pass --task <id> or open a Compound task first.");

  const triggerType = options.trigger || "manual";
  if (!TRIGGERS.has(triggerType)) throw new Error(`Invalid trigger "${triggerType}". Use manual, token, or stop-mid-task.`);
  const target = options.to || "claude";
  if (!TARGETS.has(target)) throw new Error(`Invalid target "${target}". Use claude or codex.`);

  const createdAt = options.createdAt || nowISO();
  const checkpointId = options.checkpointId || `cp-${compactTimestamp(new Date(createdAt))}-${slugify(task.id || task.goal)}`;
  const contextSummary = String(options.summary || `Continue task ${task.id}: ${task.goal}`).trim();

  const contract = {
    schema_version: SCHEMA_VERSION,
    checkpoint_id: checkpointId,
    created_at: createdAt,
    trigger: {
      type: triggerType,
      ...(options.reason ? { reason: String(options.reason) } : {}),
    },
    from_agent: {
      id: options.from || process.env.COMPOUND_AGENT_ID || ledger.agents_active?.at?.(-1) || "unknown-agent",
      ...(options.runtime ? { runtime: String(options.runtime) } : {}),
    },
    to_agent: {
      target,
      expected_format: target === "claude" ? "Claude Code startup prompt" : "Codex startup prompt",
    },
    task: {
      id: task.id,
      goal: task.goal,
      state: task.state,
      skills: task.skills || [],
      dod: taskDodSummary(task.dod || []),
    },
    context_summary: contextSummary,
    completed: safeList(options.completed),
    pending: safeList(options.pending),
    current_files: safeList(options.files).map((p) => normalizeRelativePath(p, cwd)),
    decisions: safeList(options.decisions),
    risks: safeList(options.risks),
    commands_run: safeList(options.commands),
    verification: safeList(options.verification),
    ledger: {
      task_path: normalizeRelativePath(ledgerPath, cwd),
      task_current: ledger.current || null,
      task_updated_at: task.updated_at || null,
    },
    safety: {
      shareable: true,
      redactions: [],
    },
  };

  const validation = validateHandoff(contract);
  if (!validation.ok) {
    contract.safety.shareable = false;
    contract.safety.redactions = validation.errors;
  }
  return contract;
}

export function validateHandoff(contract) {
  const errors = [];
  if (!contract || typeof contract !== "object") errors.push("Contract must be an object.");
  if (contract?.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must be ${SCHEMA_VERSION}.`);
  if (!contract?.checkpoint_id) errors.push("checkpoint_id is required.");
  if (!contract?.created_at || Number.isNaN(Date.parse(contract.created_at))) errors.push("created_at must be ISO-8601.");
  if (!TRIGGERS.has(contract?.trigger?.type)) errors.push("trigger.type must be manual, token, or stop-mid-task.");
  if (!contract?.from_agent?.id) errors.push("from_agent.id is required.");
  if (!TARGETS.has(contract?.to_agent?.target)) errors.push("to_agent.target must be claude or codex.");
  if (!contract?.task?.id) errors.push("task.id is required.");
  if (!contract?.context_summary) errors.push("context_summary is required.");
  for (const field of ["completed", "pending", "current_files", "decisions", "risks", "commands_run", "verification"]) {
    if (!Array.isArray(contract?.[field])) errors.push(`${field} must be an array.`);
  }

  const inspectable = JSON.stringify(contract || {});
  if (hasSecretLikeValue(inspectable)) errors.push("Possible secret detected; redact before sharing.");
  const pathFields = [
    ...(contract?.current_files || []),
    contract?.ledger?.task_path || "",
  ];
  for (const value of pathFields) {
    if (hasUserAbsolutePath(value)) errors.push(`User-absolute path detected: ${value}`);
  }

  return { ok: errors.length === 0, errors };
}

export function buildResumePrompt(contract, { target = contract?.to_agent?.target || "claude" } = {}) {
  const validation = validateHandoff(contract);
  if (!validation.ok) throw new Error(`Invalid handoff: ${validation.errors.join("; ")}`);
  const label = target === "claude" ? "Claude Code" : "Codex";
  const lines = [
    `You are ${label}, resuming a Buildr/Compound task from a handoff checkpoint.`,
    "",
    "Read first:",
    "- `.agents/PROTOCOL.md`",
    "- `.agents/TASKS.json`",
    "- this handoff JSON",
    "",
    "Resume target:",
    `- Task: ${contract.task.id} - ${contract.task.goal}`,
    `- Checkpoint: ${contract.checkpoint_id}`,
    `- Trigger: ${contract.trigger.type}${contract.trigger.reason ? ` (${contract.trigger.reason})` : ""}`,
    `- From agent: ${contract.from_agent.id}`,
    "",
    "Context summary:",
    contract.context_summary,
    "",
    "Completed:",
    ...(contract.completed.length ? contract.completed.map((item) => `- ${item}`) : ["- None recorded"]),
    "",
    "Pending:",
    ...(contract.pending.length ? contract.pending.map((item) => `- ${item}`) : ["- Inspect task DoD and continue the next unfinished step"]),
    "",
    "Current files:",
    ...(contract.current_files.length ? contract.current_files.map((item) => `- ${item}`) : ["- None recorded"]),
    "",
    "Decisions:",
    ...(contract.decisions.length ? contract.decisions.map((item) => `- ${item}`) : ["- None recorded"]),
    "",
    "Risks:",
    ...(contract.risks.length ? contract.risks.map((item) => `- ${item}`) : ["- None recorded"]),
    "",
    "Verification state:",
    ...(contract.verification.length ? contract.verification.map((item) => `- ${item}`) : ["- Run the task DoD checks before claiming done"]),
    "",
    "Instructions:",
    "- Sign in to the ledger with your agent id.",
    "- Confirm the current task is still active or resume it before edits.",
    "- Continue from Pending, not from scratch.",
    "- Preserve the handoff contract; write a new checkpoint before stopping.",
  ];
  return `${lines.join("\n")}\n`;
}

export function writeCheckpoint(options = {}) {
  const cwd = options.cwd ? resolve(options.cwd) : REPO_ROOT;
  const ledgerPath = resolve(cwd, options.ledgerPath || DEFAULT_LEDGER);
  const ledger = options.ledger || loadLedger(ledgerPath);
  const task = findTask(ledger, options.taskId);
  if (!task) throw new Error("No task found. Pass --task <id> or open a Compound task first.");
  const contract = createHandoffContract({ ...options, cwd, ledgerPath, ledger, task });
  const validation = validateHandoff(contract);
  if (!validation.ok) throw new Error(`Refusing unsafe handoff: ${validation.errors.join("; ")}`);

  const outPath = resolve(cwd, options.out || `handoffs/${contract.checkpoint_id}.handoff.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(contract, null, 2) + "\n");

  task.handoffs = task.handoffs || [];
  task.handoffs.push({
    checkpoint_id: contract.checkpoint_id,
    path: normalizeRelativePath(outPath, cwd),
    to: contract.to_agent.target,
    trigger: contract.trigger.type,
    created_at: contract.created_at,
  });
  task.last_handoff = task.handoffs.at(-1);
  task.updated_at = contract.created_at;
  ledger.current = ledger.current || task.id;
  ledger.log = ledger.log || [];
  ledger.log.push({
    ts: contract.created_at,
    event: "handoff-checkpoint",
    task: task.id,
    agent: contract.from_agent.id,
    checkpoint_id: contract.checkpoint_id,
    to: contract.to_agent.target,
    path: normalizeRelativePath(outPath, cwd),
  });
  saveLedger(ledger, ledgerPath);

  return { contract, outPath, ledger };
}

export function loadHandoff(path, cwd = REPO_ROOT) {
  const abs = resolve(cwd, path);
  const contract = JSON.parse(readFileSync(abs, "utf-8"));
  const validation = validateHandoff(contract);
  if (!validation.ok) throw new Error(`Invalid handoff: ${validation.errors.join("; ")}`);
  return contract;
}

export function writeResumePrompt({ handoffPath, out, target, cwd = REPO_ROOT } = {}) {
  if (!handoffPath) throw new Error("--from <handoff.json> is required for resume.");
  const contract = loadHandoff(handoffPath, cwd);
  const prompt = buildResumePrompt(contract, { target });
  if (out) {
    const outPath = resolve(cwd, out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, prompt);
    return { contract, prompt, outPath };
  }
  return { contract, prompt, outPath: null };
}

function printUsage() {
  console.log(`handoff-bridge - checkpoint/resume bridge

Usage:
  node handoff-bridge.mjs checkpoint [options]
  node handoff-bridge.mjs resume --from <handoff.json> [--out RESUME.md]
  node handoff-bridge.mjs verify --from <handoff.json>

Checkpoint options:
  --task <id>              Task id, defaults to ledger current
  --to <claude|codex>      Target agent, default claude
  --trigger <type>         manual | token | stop-mid-task, default manual
  --summary <text>         Required context summary; defaults from task
  --completed <text>       Repeatable
  --pending <text>         Repeatable
  --file <path>            Repeatable, converted to repo-relative when possible
  --decision <text>        Repeatable
  --risk <text>            Repeatable
  --command <text>         Repeatable
  --verification <text>    Repeatable
  --out <path>             Default handoffs/<checkpoint>.handoff.json

Resume options:
  --from <handoff.json>    Handoff contract to resume from
  --target <claude|codex>  Override prompt target
  --out <path>             Write prompt to file instead of stdout
`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  try {
    if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
      printUsage();
      return;
    }
    if (cmd === "checkpoint") {
      const result = writeCheckpoint({
        taskId: args.task,
        to: args.to || "claude",
        trigger: args.trigger || "manual",
        reason: args.reason,
        summary: args.summary,
        completed: args.completed,
        pending: args.pending,
        files: args.file,
        decisions: args.decision,
        risks: args.risk,
        commands: args.command,
        verification: args.verification,
        out: args.out,
        from: args.fromAgent || args.from,
        runtime: args.runtime,
      });
      console.log(`checkpoint: ${result.contract.checkpoint_id}`);
      console.log(`wrote: ${result.outPath}`);
      return;
    }
    if (cmd === "resume") {
      const result = writeResumePrompt({
        handoffPath: args.from || args._[0],
        target: args.target,
        out: args.out,
      });
      if (result.outPath) console.log(`wrote: ${result.outPath}`);
      else process.stdout.write(result.prompt);
      return;
    }
    if (cmd === "verify") {
      const contract = loadHandoff(args.from || args._[0]);
      console.log(`valid: ${contract.checkpoint_id}`);
      return;
    }
    throw new Error(`Unknown command: ${cmd}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
