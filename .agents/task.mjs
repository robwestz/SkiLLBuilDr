#!/usr/bin/env node
// .agents/task.mjs — Compound Protocol task ledger CLI
// Zero runtime dependencies. Node 18+.
// See .agents/PROTOCOL.md, .agents/DOD.md, .agents/SKILL_SELECT.md, .agents/PLAN_MARKERS.md

import { readFileSync, writeFileSync, existsSync, statSync, renameSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const TASKS_PATH = process.env.COMPOUND_TASKS_PATH || join(__dirname, "TASKS.json");

const COLORS = process.stdout.isTTY
  ? { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", cyan: "\x1b[36m", dim: "\x1b[2m", reset: "\x1b[0m" }
  : { red: "", green: "", yellow: "", cyan: "", dim: "", reset: "" };
const c = (color, s) => `${COLORS[color]}${s}${COLORS.reset}`;

const nowISO = () => new Date().toISOString();

function loadLedger() {
  if (!existsSync(TASKS_PATH)) {
    return { version: "1", schema_url: ".agents/PROTOCOL.md", current: null, tasks: [], agents_active: [], log: [] };
  }
  return JSON.parse(readFileSync(TASKS_PATH, "utf-8"));
}

function saveLedger(ledger) {
  const tmp = TASKS_PATH + ".tmp";
  mkdirSync(dirname(TASKS_PATH), { recursive: true });
  writeFileSync(tmp, JSON.stringify(ledger, null, 2) + "\n");
  renameSync(tmp, TASKS_PATH);
}

function nextId(ledger) {
  let max = 0;
  for (const t of ledger.tasks) {
    const m = /^t-(\d+)$/.exec(t.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `t-${String(max + 1).padStart(3, "0")}`;
}

function appendLog(ledger, event, taskId, agent, extra = {}) {
  ledger.log.push({ ts: nowISO(), event, task: taskId, agent: agent || null, ...extra });
}

function findTask(ledger, id) {
  return ledger.tasks.find((t) => t.id === id);
}

function parseDodSpec(spec) {
  const idx = spec.indexOf(":");
  if (idx === -1) throw new Error(`Bad DoD spec "${spec}". Expected "<type>:<value>" (test|artifact|manual).`);
  const type = spec.slice(0, idx).trim();
  const value = spec.slice(idx + 1).trim();
  if (type === "test") return { check: "test", command: value, passed_at: null };
  if (type === "artifact") return { check: "artifact", path: value, passed_at: null };
  if (type === "manual") return { check: "manual", description: value, passed_at: null };
  throw new Error(`Unknown DoD type "${type}". Allowed: test, artifact, manual.`);
}

function parseArgs(argv) {
  const args = { _: [], dod: [], skill: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dod") args.dod.push(argv[++i]);
    else if (a === "--skill") args.skill.push(argv[++i]);
    else if (a === "--parent") args.parent = argv[++i];
    else if (a === "--reason") args.reason = argv[++i];
    else if (a === "--unlock") args.unlock = argv[++i];
    else if (a === "--qa") args.qa = true;
    else if (a === "--all") args.all = true;
    else if (a === "--state") args.state = argv[++i];
    else if (a === "--apply") args.apply = true;
    else if (a === "--diff") args.diff = true;
    else if (a === "--strict") args.strict = true;
    else if (a === "--remove-dod") args.removeDod = parseInt(argv[++i], 10);
    else if (a.startsWith("--")) args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else args._.push(a);
  }
  return args;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a.trim()); }));
}

// ============================ COMMANDS ============================

function cmdStatus() {
  const ledger = loadLedger();
  const cur = ledger.current ? findTask(ledger, ledger.current) : null;
  const open = ledger.tasks.filter((t) => t.state === "in_progress" || t.state === "open").length;
  const blocked = ledger.tasks.filter((t) => t.state === "blocked").length;
  const parked = ledger.tasks.filter((t) => t.state === "parked").length;
  console.log(c("cyan", "── Compound Protocol Ledger ──"));
  if (cur) {
    console.log(`Current: ${c("green", cur.id)} (${cur.state}) — ${cur.goal}`);
    if (cur.dod && cur.dod.length) {
      const passed = cur.dod.filter((d) => d.passed_at).length;
      console.log(`  DoD: ${passed}/${cur.dod.length} passed`);
      for (const d of cur.dod) {
        const tag = d.passed_at ? c("green", "✓") : c("dim", "·");
        const detail = d.command || d.path || d.description;
        console.log(`    ${tag} ${d.check}: ${detail}`);
      }
    }
    if (cur.skills && cur.skills.length) console.log(`  Skills: ${cur.skills.join(", ")}`);
  } else {
    console.log(c("dim", "No current task. Use: task.mjs open \"<goal>\" --dod \"<type>:<value>\""));
  }
  console.log(`Open: ${open}  Blocked: ${blocked}  Parked: ${parked}  Total: ${ledger.tasks.length}`);
  if (blocked > 0) {
    console.log(c("yellow", "Blocked tasks:"));
    for (const t of ledger.tasks.filter((t) => t.state === "blocked")) {
      console.log(`  ${t.id}: ${t.goal} — unlock: ${t.unlock_command || "(none)"}`);
    }
  }
}

function cmdCurrent() {
  const ledger = loadLedger();
  process.stdout.write(ledger.current || "");
}

function cmdAck(args) {
  const agentId = args._[1];
  if (!agentId) throw new Error("Usage: task.mjs ack <agent-id>");
  const ledger = loadLedger();
  if (!ledger.agents_active.includes(agentId)) ledger.agents_active.push(agentId);
  appendLog(ledger, "ack", null, agentId);
  saveLedger(ledger);
  console.log(c("green", `✓ Agent "${agentId}" signed in.`));
  cmdStatus();
}

function cmdOpen(args) {
  const goal = args._[1];
  if (!goal) throw new Error("Usage: task.mjs open \"<goal>\" --dod \"<type>:<value>\" [--skill <id>] [--parent <id>]");
  if (!args.qa && (!args.dod || args.dod.length === 0)) {
    throw new Error("ERROR: task open requires at least one --dod. For Q&A-only tasks, use --qa.");
  }
  const ledger = loadLedger();
  if (ledger.current) {
    const cur = findTask(ledger, ledger.current);
    if (cur && cur.state === "in_progress") {
      throw new Error(
        `ERROR: Task ${cur.id} is in_progress. Park or finish it first:\n` +
        `  node .agents/task.mjs park ${cur.id} --reason "<text>"\n` +
        `  node .agents/task.mjs done ${cur.id}`
      );
    }
  }
  const id = nextId(ledger);
  const task = {
    id,
    goal,
    state: args.qa ? "q-and-a" : "in_progress",
    dod: (args.dod || []).map(parseDodSpec),
    skills: args.skill || [],
    blocked_by: null,
    unlock_command: null,
    park_reason: null,
    parent: args.parent || null,
    agent: process.env.COMPOUND_AGENT_ID || ledger.agents_active[ledger.agents_active.length - 1] || null,
    started_at: nowISO(),
    updated_at: nowISO(),
  };
  ledger.tasks.push(task);
  ledger.current = id;
  appendLog(ledger, "open", id, task.agent, { goal });
  saveLedger(ledger);
  console.log(c("green", `✓ Opened ${id}: ${goal}`));
  console.log(`  State: ${task.state}`);
  if (task.dod.length) console.log(`  DoD: ${task.dod.length} check(s)`);
  if (task.skills.length) console.log(`  Skills: ${task.skills.join(", ")}`);
  if (!task.skills.length && !args.qa) {
    console.log(c("yellow", "WARN: no --skill declared. Run: task.mjs update " + id + " --skill <id>"));
    console.log(c("yellow", "      See .agents/SKILL_SELECT.md for selection rules."));
  }
}

function cmdList(args) {
  const ledger = loadLedger();
  let tasks = ledger.tasks;
  if (args.state) tasks = tasks.filter((t) => t.state === args.state);
  else if (!args.all) tasks = tasks.filter((t) => t.state !== "done" && t.state !== "abandoned");
  if (!tasks.length) { console.log(c("dim", "No tasks match.")); return; }
  for (const t of tasks) {
    const stateColor = t.state === "in_progress" ? "green" : t.state === "blocked" ? "red" : t.state === "done" ? "dim" : "yellow";
    const cur = ledger.current === t.id ? c("cyan", " ★") : "";
    console.log(`${t.id}${cur}  ${c(stateColor, t.state.padEnd(12))}  ${t.goal}`);
    if (t.skills && t.skills.length) console.log(c("dim", `        skills: ${t.skills.join(", ")}`));
  }
}

function cmdShow(args) {
  const id = args._[1];
  if (!id) throw new Error("Usage: task.mjs show <id>");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  console.log(JSON.stringify(t, null, 2));
}

async function runDodCheck(check) {
  if (check.check === "test") {
    const r = spawnSync(check.command, [], { shell: true, stdio: "pipe", encoding: "utf-8", cwd: REPO_ROOT });
    const tail = (r.stdout + r.stderr).trim().split("\n").slice(-5).join("\n");
    return { ok: r.status === 0, exit: r.status, tail };
  }
  if (check.check === "artifact") {
    if (!existsSync(check.path)) return { ok: false, reason: `Path not found: ${check.path}` };
    const st = statSync(check.path);
    if (check.min_bytes && st.size < check.min_bytes) return { ok: false, reason: `Size ${st.size} < min_bytes ${check.min_bytes}` };
    if (check.contains && st.isFile()) {
      const content = readFileSync(check.path, "utf-8");
      const re = new RegExp(check.contains);
      if (!re.test(content)) return { ok: false, reason: `Does not contain: ${check.contains}` };
    }
    return { ok: true, size: st.size };
  }
  if (check.check === "manual") {
    const ans = await prompt(`  Manual: ${check.description}\n  Confirmed? [y/N]: `);
    return { ok: /^y(es)?$/i.test(ans), confirmer: process.env.USER || process.env.USERNAME || "operator" };
  }
  return { ok: false, reason: `Unknown check type: ${check.check}` };
}

async function cmdVerify(args) {
  const id = args._[1] || (loadLedger().current);
  if (!id) throw new Error("Usage: task.mjs verify <id> (or set current task)");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  if (!t.dod || !t.dod.length) { console.log(c("yellow", `Task ${id} has no DoD checks.`)); return; }
  let allPass = true;
  for (let i = 0; i < t.dod.length; i++) {
    const d = t.dod[i];
    process.stdout.write(`[${i + 1}/${t.dod.length}] check: ${d.check} ... `);
    const result = await runDodCheck(d);
    if (result.ok) {
      d.passed_at = nowISO();
      if (result.confirmer) d.confirmed_by = result.confirmer;
      if (result.size != null) d.artifact_size = result.size;
      console.log(c("green", "✓"));
      if (result.tail) console.log(c("dim", "    " + result.tail.replace(/\n/g, "\n    ")));
    } else {
      d.passed_at = null;
      d.last_failure = { ts: nowISO(), ...result };
      console.log(c("red", "✗"));
      if (result.reason) console.log(c("red", "    " + result.reason));
      if (result.tail) console.log(c("dim", "    " + result.tail.replace(/\n/g, "\n    ")));
      allPass = false;
    }
  }
  t.updated_at = nowISO();
  appendLog(ledger, "verify", id, t.agent, { allPass });
  saveLedger(ledger);
  if (allPass) console.log(c("green", `\n✓ All DoD checks passed. Run: task.mjs done ${id}`));
  else { console.log(c("red", `\n✗ Verification failed. Fix and re-run: task.mjs verify ${id}`)); process.exit(1); }
}

async function cmdDone(args) {
  const id = args._[1] || (loadLedger().current);
  if (!id) throw new Error("Usage: task.mjs done <id>");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  const unverified = (t.dod || []).filter((d) => !d.passed_at);
  if (unverified.length) {
    console.error(c("red", `ERROR: ${unverified.length}/${t.dod.length} DoD checks have not passed:`));
    for (const d of unverified) console.error(`  - ${d.check}: ${d.command || d.path || d.description}`);
    console.error(c("yellow", `\nUnlock: node .agents/task.mjs verify ${id}`));
    process.exit(1);
  }
  t.state = "done";
  t.completed_at = nowISO();
  t.updated_at = nowISO();
  if (ledger.current === id) ledger.current = null;
  appendLog(ledger, "done", id, t.agent);
  saveLedger(ledger);
  console.log(c("green", `✓ ${id} done.`));
  console.log(c("cyan", "\nNow log the COMPOUND register per .agents/COMPOUND.md."));
}

function cmdPark(args) {
  const id = args._[1];
  const reason = args.reason || args._[2];
  if (!id || !reason) throw new Error("Usage: task.mjs park <id> --reason \"<text>\"");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  t.state = "parked";
  t.park_reason = reason;
  t.updated_at = nowISO();
  if (ledger.current === id) ledger.current = null;
  appendLog(ledger, "park", id, t.agent, { reason });
  saveLedger(ledger);
  console.log(c("yellow", `⏸ Parked ${id}: ${reason}`));
}

function cmdResume(args) {
  const id = args._[1];
  if (!id) throw new Error("Usage: task.mjs resume <id>");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  if (ledger.current && ledger.current !== id) {
    const cur = findTask(ledger, ledger.current);
    if (cur && cur.state === "in_progress") throw new Error(`ERROR: Task ${cur.id} is in_progress. Park it first.`);
  }
  t.state = "in_progress";
  t.park_reason = null;
  t.updated_at = nowISO();
  ledger.current = id;
  appendLog(ledger, "resume", id, t.agent);
  saveLedger(ledger);
  console.log(c("green", `▶ Resumed ${id}: ${t.goal}`));
}

function cmdBlock(args) {
  const id = args._[1];
  const reason = args.reason || args._[2];
  if (!id || !reason || !args.unlock) throw new Error("Usage: task.mjs block <id> --reason \"<text>\" --unlock \"<command>\"");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  t.state = "blocked";
  t.blocked_by = reason;
  t.unlock_command = args.unlock;
  t.updated_at = nowISO();
  appendLog(ledger, "block", id, t.agent, { reason });
  saveLedger(ledger);
  console.log(c("red", `⛔ Blocked ${id}: ${reason}`));
  console.log(c("yellow", `   Unlock: ${args.unlock}`));
}

function cmdAbandon(args) {
  const id = args._[1];
  const reason = args.reason || args._[2];
  if (!id || !reason) throw new Error("Usage: task.mjs abandon <id> --reason \"<text>\"");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  t.state = "abandoned";
  t.abandon_reason = reason;
  t.updated_at = nowISO();
  if (ledger.current === id) ledger.current = null;
  appendLog(ledger, "abandon", id, t.agent, { reason });
  saveLedger(ledger);
  console.log(c("dim", `✗ Abandoned ${id}: ${reason}`));
}

function cmdUpdate(args) {
  const id = args._[1];
  if (!id) throw new Error("Usage: task.mjs update <id> [--skill <id>] [--dod <spec>] [--remove-dod <i> --reason <r>]");
  const ledger = loadLedger();
  const t = findTask(ledger, id);
  if (!t) throw new Error(`Task ${id} not found.`);
  if (args.skill && args.skill.length) for (const s of args.skill) if (!t.skills.includes(s)) t.skills.push(s);
  if (args.dod && args.dod.length) for (const spec of args.dod) t.dod.push(parseDodSpec(spec));
  if (args.removeDod != null) {
    if (!args.reason) throw new Error("--remove-dod requires --reason \"<text>\"");
    const removed = t.dod.splice(args.removeDod, 1)[0];
    t.dod_removed = t.dod_removed || [];
    t.dod_removed.push({ check: removed, reason: args.reason, ts: nowISO() });
    appendLog(ledger, "remove-dod", id, t.agent, { reason: args.reason, removed });
  }
  t.updated_at = nowISO();
  saveLedger(ledger);
  console.log(c("green", `✓ Updated ${id}.`));
}

// ----- Plan-marker import -----

function parseFrontmatter(content) {
  const m = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!m) return null;
  return parseSimpleYaml(m[1]);
}

function parseSimpleYaml(yaml) {
  const lines = yaml.split("\n");
  const result = {};
  const stack = [{ obj: result, indent: -1 }];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const cur = stack[stack.length - 1].obj;
    if (trimmed.startsWith("- ")) {
      const item = trimmed.slice(2);
      if (!Array.isArray(cur)) continue;
      if (item.includes(":")) {
        const newObj = {};
        cur.push(newObj);
        const [k, ...rest] = item.split(":");
        const v = rest.join(":").trim();
        if (v) newObj[k.trim()] = stripQuotes(v);
        stack.push({ obj: newObj, indent });
      } else {
        cur.push(stripQuotes(item));
      }
      continue;
    }
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (!value) {
      const next = lines.slice(i + 1).find((l) => l.trim());
      if (next && next.trim().startsWith("- ")) { cur[key] = []; stack.push({ obj: cur[key], indent }); }
      else { cur[key] = {}; stack.push({ obj: cur[key], indent }); }
    } else {
      cur[key] = stripQuotes(value);
    }
  }
  return result;
}

function stripQuotes(s) {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s === "null") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  return s;
}

function parseInlineMarkers(content) {
  const re = /\[COMPOUND-PHASE\s+([^\]]+)\]/g;
  const phases = [];
  let m;
  while ((m = re.exec(content))) {
    const attrs = parseInlineAttrs(m[1]);
    if (!attrs.id) continue;
    const phase = { id: attrs.id, goal: attrs.goal || "", skills: [], dod: [], parent: attrs.parent || null };
    if (attrs.skills) phase.skills = attrs.skills.split(";").map((s) => s.trim()).filter(Boolean);
    if (attrs.dod) for (const spec of attrs.dod.split(";")) { const t = spec.trim(); if (t) phase.dod.push(parseDodSpec(t)); }
    phases.push(phase);
  }
  return phases;
}

function parseInlineAttrs(s) {
  const out = {};
  const re = /(\w+)=("([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[3] != null ? m[3] : m[4];
  return out;
}

function cmdImport(args) {
  const file = args._[1];
  if (!file) throw new Error("Usage: task.mjs import <plan-file> [--apply]");
  const content = readFileSync(file, "utf-8");
  const fm = parseFrontmatter(content);
  const isActive = (fm && fm.compound === "active") || /<!--\s*COMPOUND:\s*active\s*-->/i.test(content);
  if (!isActive) { console.log(c("yellow", `Plan ${file} is not marked compound:active. Skipping.`)); return; }
  let phases = [];
  if (fm && fm.phases) {
    for (const p of fm.phases) {
      const phase = { id: p.id, goal: p.goal || "", skills: p.skills || [], parent: p.parent || null, dod: [] };
      if (p.dod) for (const d of p.dod) {
        if (d.check === "test") phase.dod.push({ check: "test", command: d.command, passed_at: null });
        else if (d.check === "artifact") phase.dod.push({ check: "artifact", path: d.path, passed_at: null });
        else if (d.check === "manual") phase.dod.push({ check: "manual", description: d.description, passed_at: null });
      }
      phases.push(phase);
    }
  }
  phases = phases.concat(parseInlineMarkers(content));
  const ledger = loadLedger();
  const existing = new Set(ledger.tasks.map((t) => t.id));
  const toAdd = phases.filter((p) => !existing.has(p.id));
  const toUpdate = phases.filter((p) => existing.has(p.id));
  console.log(c("cyan", `Plan: ${file}`));
  console.log(`  + ${toAdd.length} new task(s)`);
  console.log(`  ~ ${toUpdate.length} existing task(s)`);
  if (!args.apply) {
    if (toAdd.length) {
      console.log(c("dim", "\nWould add:"));
      for (const p of toAdd) console.log(`  ${p.id}: ${p.goal} (skills: ${(p.skills || []).join(",")}, dod: ${p.dod.length})`);
    }
    console.log(c("yellow", "\nDry-run. Re-run with --apply to write to ledger."));
    return;
  }
  for (const p of toAdd) {
    ledger.tasks.push({
      id: p.id, goal: p.goal, state: "open", dod: p.dod, skills: p.skills,
      blocked_by: null, unlock_command: null, park_reason: null,
      parent: p.parent, agent: null, started_at: nowISO(), updated_at: nowISO(),
    });
    appendLog(ledger, "import", p.id, null, { source: file });
  }
  saveLedger(ledger);
  console.log(c("green", `✓ Imported ${toAdd.length} task(s).`));
}

// ----- Hook handlers -----

function hookSessionStart() {
  const ledger = loadLedger();
  const cur = ledger.current ? findTask(ledger, ledger.current) : null;
  const open = ledger.tasks.filter((t) => t.state === "in_progress" || t.state === "open").length;
  const blocked = ledger.tasks.filter((t) => t.state === "blocked").length;
  let msg = `\n[Compound Protocol] ledger: ${open} open, ${blocked} blocked.`;
  if (cur) msg += `\n  Current task: ${cur.id} (${cur.state}) — ${cur.goal}`;
  if (blocked > 0) msg += `\n  Blocked tasks need attention. Run: node .agents/task.mjs status`;
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg } }));
}

function hookPreEdit() {
  const enforce = process.env.COMPOUND_ENFORCE === "1";
  const ledger = loadLedger();
  const cur = ledger.current ? findTask(ledger, ledger.current) : null;
  if (cur && cur.state === "in_progress") { process.exit(0); }
  const msg = "[Compound Protocol] No in_progress task. Open one before editing:\n" +
    "  node .agents/task.mjs open \"<goal>\" --dod \"<type>:<value>\" --skill <id>";
  if (enforce) { console.error(msg); process.exit(2); }
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: msg } }));
}

function hookStop() {
  const ledger = loadLedger();
  if (ledger.current) {
    const t = findTask(ledger, ledger.current);
    if (t) { t.updated_at = nowISO(); saveLedger(ledger); }
  }
}

// ============================ MAIN ============================

const HELP = `task.mjs — Compound Protocol task ledger
Usage:
  task.mjs status                                Show current task + ledger summary
  task.mjs current                               Print current task id only
  task.mjs ack <agent-id>                        Sign in as agent
  task.mjs open "<goal>" --dod "<type>:<value>" [--skill <id>] [--parent <id>] [--qa]
  task.mjs list [--state <s>] [--all]            List tasks
  task.mjs show <id>                             Full task JSON
  task.mjs verify [<id>]                         Run DoD checks
  task.mjs done [<id>]                           Close task (requires DoD all passed)
  task.mjs park <id> --reason "<text>"           Park task
  task.mjs resume <id>                           Resume parked task
  task.mjs block <id> --reason "<text>" --unlock "<cmd>"
  task.mjs abandon <id> --reason "<text>"
  task.mjs update <id> [--skill <id>] [--dod <spec>] [--remove-dod <i> --reason <r>]
  task.mjs import <plan-file> [--apply]

  task.mjs hook <event>                          (internal — invoked by Claude hooks)

DoD specs: test:<command> | artifact:<path> | manual:<description>
See .agents/PROTOCOL.md for the full contract.
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  try {
    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") { console.log(HELP); return; }
    if (cmd === "status") return cmdStatus();
    if (cmd === "current") return cmdCurrent();
    if (cmd === "ack") return cmdAck(args);
    if (cmd === "open") return cmdOpen(args);
    if (cmd === "list") return cmdList(args);
    if (cmd === "show") return cmdShow(args);
    if (cmd === "verify") return await cmdVerify(args);
    if (cmd === "done") return await cmdDone(args);
    if (cmd === "park") return cmdPark(args);
    if (cmd === "resume") return cmdResume(args);
    if (cmd === "block") return cmdBlock(args);
    if (cmd === "abandon") return cmdAbandon(args);
    if (cmd === "update") return cmdUpdate(args);
    if (cmd === "import") return cmdImport(args);
    if (cmd === "hook") {
      const ev = args._[1];
      if (ev === "session-start") return hookSessionStart();
      if (ev === "pre-edit") return hookPreEdit();
      if (ev === "stop") return hookStop();
      throw new Error(`Unknown hook event: ${ev}`);
    }
    throw new Error(`Unknown command: ${cmd}\n\n${HELP}`);
  } catch (err) {
    console.error(c("red", err.message));
    process.exit(1);
  }
}

main();
