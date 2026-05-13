#!/usr/bin/env node
// factory-status.mjs — minimal Agentic Factory v1 status reporter.
//
// Reads catalog (data.json or data.public.js), Compound task ledger
// (.agents/TASKS.json) and routine manifests (routines/*.routine.json) and
// prints a concise status to stdout. Pass --json for a structured payload
// (used by factory-status.html and by tests).
//
// Zero npm deps. Read-only.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Loaders ───────────────────────────────────────────────────────────────

function loadCatalog(repoRoot = __dirname) {
  const dataJson = join(repoRoot, "data.json");
  if (existsSync(dataJson)) {
    try {
      const parsed = JSON.parse(readFileSync(dataJson, "utf-8"));
      const items = Array.isArray(parsed) ? parsed : parsed.items || [];
      return { source: "data.json", count: items.length };
    } catch {
      // fall through to public snapshot
    }
  }
  const dataPublic = join(repoRoot, "data.public.js");
  if (existsSync(dataPublic)) {
    const text = readFileSync(dataPublic, "utf-8");
    // Public snapshot is `window.DATA = { items: [...] };` style — count item entries.
    const match = text.match(/"items"\s*:\s*\[([\s\S]*?)\]/);
    if (match) {
      // Crude but dependency-free: count top-level {…} objects.
      const arr = match[1];
      let depth = 0;
      let count = 0;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        if (c === "{") {
          if (depth === 0) count += 1;
          depth += 1;
        } else if (c === "}") depth -= 1;
      }
      return { source: "data.public.js", count };
    }
  }
  return { source: null, count: 0 };
}

function loadRoutines(repoRoot = __dirname) {
  const dir = join(repoRoot, "routines");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".routine.json"));
  return files
    .map((f) => {
      try {
        const r = JSON.parse(readFileSync(join(dir, f), "utf-8"));
        return {
          id: r.id,
          title: r.title,
          cadence: r.cadence,
          step_count: Array.isArray(r.steps) ? r.steps.length : 0,
          source_file: f,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function loadLedger(repoRoot = __dirname) {
  const path = join(repoRoot, ".agents", "TASKS.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function tallyTasks(ledger) {
  if (!ledger || !Array.isArray(ledger.tasks)) {
    return { total: 0, in_progress: 0, parked: 0, done: 0, blocked: 0, abandoned: 0 };
  }
  const tally = { total: ledger.tasks.length, in_progress: 0, parked: 0, done: 0, blocked: 0, abandoned: 0 };
  for (const t of ledger.tasks) tally[t.state] = (tally[t.state] ?? 0) + 1;
  return tally;
}

// ─── Aggregation ──────────────────────────────────────────────────────────

export function collectStatus(repoRoot = __dirname) {
  const catalog = loadCatalog(repoRoot);
  const routines = loadRoutines(repoRoot);
  const ledger = loadLedger(repoRoot);
  const tasks = tallyTasks(ledger);
  return {
    generated_at: new Date().toISOString(),
    catalog,
    routines,
    tasks,
    current_task: ledger?.current ?? null,
  };
}

// ─── Rendering ─────────────────────────────────────────────────────────────

function renderText(status) {
  const lines = [
    `Agentic Factory v1 — status`,
    `Generated: ${status.generated_at}`,
    "",
    `Catalog : ${status.catalog.count} items (source: ${status.catalog.source || "missing"})`,
    `Routines: ${status.routines.length} on disk`,
  ];
  for (const r of status.routines) {
    lines.push(`  - ${r.id} (${r.cadence}, ${r.step_count} steps) — ${r.title}`);
  }
  lines.push("");
  lines.push(
    `Tasks   : total=${status.tasks.total}` +
      ` in_progress=${status.tasks.in_progress}` +
      ` parked=${status.tasks.parked}` +
      ` done=${status.tasks.done}` +
      ` blocked=${status.tasks.blocked}` +
      ` abandoned=${status.tasks.abandoned}`
  );
  if (status.current_task) {
    lines.push(`Current : ${status.current_task}`);
  } else {
    lines.push(`Current : (none)`);
  }
  return lines.join("\n");
}

function main() {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes("--json");
  const status = collectStatus(__dirname);
  if (wantJson) {
    process.stdout.write(JSON.stringify(status, null, 2) + "\n");
  } else {
    process.stdout.write(renderText(status) + "\n");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
