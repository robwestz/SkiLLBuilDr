#!/usr/bin/env node
// .agents/activate.mjs — idempotent installer for Compound Protocol hooks
// Writes hook config to .claude/settings.json. Safe to run multiple times.
// See .agents/PROTOCOL.md.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SETTINGS_PATH = join(REPO_ROOT, ".claude", "settings.json");
const TASKS_PATH = join(__dirname, "TASKS.json");

const HOOK_MARKER = "compound-protocol";

const HOOKS_TO_INSTALL = {
  SessionStart: [
    {
      hooks: [{ type: "command", command: "node .agents/task.mjs hook session-start", _compound: HOOK_MARKER }],
    },
  ],
  PreToolUse: [
    {
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: "node .agents/task.mjs hook pre-edit", _compound: HOOK_MARKER }],
    },
  ],
  Stop: [
    {
      hooks: [{ type: "command", command: "node .agents/task.mjs hook stop", _compound: HOOK_MARKER }],
    },
  ],
};

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
}

function saveSettings(s) {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2) + "\n");
}

function ensureTasksLedger() {
  if (existsSync(TASKS_PATH)) return false;
  writeFileSync(
    TASKS_PATH,
    JSON.stringify(
      { version: "1", schema_url: ".agents/PROTOCOL.md", current: null, tasks: [], agents_active: [], log: [] },
      null,
      2
    ) + "\n"
  );
  return true;
}

function mergeHooks(existing, incoming) {
  const out = { ...existing };
  for (const [event, configs] of Object.entries(incoming)) {
    if (!Array.isArray(out[event])) out[event] = [];
    for (const cfg of configs) {
      const idx = out[event].findIndex(
        (e) =>
          Array.isArray(e.hooks) &&
          e.hooks.some((h) => h._compound === HOOK_MARKER) &&
          e.matcher === cfg.matcher
      );
      if (idx >= 0) out[event][idx] = cfg;
      else out[event].push(cfg);
    }
  }
  return out;
}

function main() {
  const created = ensureTasksLedger();
  const settings = loadSettings();
  const before = JSON.stringify(settings.hooks || {});
  settings.hooks = mergeHooks(settings.hooks || {}, HOOKS_TO_INSTALL);
  const changed = JSON.stringify(settings.hooks) !== before;
  if (changed) saveSettings(settings);
  console.log("Compound Protocol — activation");
  console.log("  Settings: " + SETTINGS_PATH);
  console.log("  Tasks ledger: " + TASKS_PATH + (created ? " (created)" : " (already present)"));
  console.log("  Hooks: " + (changed ? "installed/updated" : "already up to date"));
  console.log("");
  console.log("Installed hooks:");
  for (const ev of Object.keys(HOOKS_TO_INSTALL)) console.log(`  - ${ev}: node .agents/task.mjs hook ...`);
  console.log("");
  console.log("Mode: " + (process.env.COMPOUND_ENFORCE === "1" ? "ENFORCE (block on violation)" : "WARN (advisory)"));
  console.log("To enable enforcement: export COMPOUND_ENFORCE=1");
  console.log("");
  console.log("Next: read .agents/PROTOCOL.md, then `node .agents/task.mjs ack <your-agent-id>`");
}

main();
