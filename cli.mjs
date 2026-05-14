#!/usr/bin/env node
// cli.mjs — command-line interface to the skill catalog.
// Zero npm dependencies; uses only Node built-ins.
//
// Usage:
//   node cli.mjs --goal "build a SaaS with auth"
//   node cli.mjs --search "python review"
//   node cli.mjs --get /everything-claude-code:python-reviewer
//   node cli.mjs --sources
//
// Facts:
// 1. Callers: package.json bin.cli entry; invoked by user as `node cli.mjs`
// 2. No existing file serves the same purpose
// 3. Data read: data.json → { items: [{slug, name, description, category, type, source}] }
// 4. User instruction: "paus kan jag säga till om och tills dess får du gärna grinda!"

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { handleToolCall } from "./mcp-server.mjs";
import { LLMClient } from "./llm-client.mjs";
import { collectStatus } from "./factory-status.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    goal: null, search: null, get: null, sources: false,
    status: false, recipes: false, assemble: null, routine: null,
    type: null, limit: 10, json: false, data: null, help: false, ai: false,
    tier: null, out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--goal")          { out.goal = argv[++i]; }
    else if (a === "--search")   { out.search = argv[++i]; }
    else if (a === "--get")      { out.get = argv[++i]; }
    else if (a === "--sources")  { out.sources = true; }
    else if (a === "--status")   { out.status = true; }
    else if (a === "--recipes")  { out.recipes = true; }
    else if (a === "--assemble") { out.assemble = argv[++i]; }
    else if (a === "--routine")  { out.routine = argv[++i]; }
    else if (a === "--type")     { out.type = argv[++i]; }
    else if (a === "--limit")    { out.limit = parseInt(argv[++i], 10) || 10; }
    else if (a === "--tier")     { out.tier = argv[++i]; }
    else if (a === "--out")      { out.out = argv[++i]; }
    else if (a === "--json")     { out.json = true; }
    else if (a === "--data")     { out.data = argv[++i]; }
    else if (a === "--ai")       { out.ai = true; }
    else if (a === "--help" || a === "-h") { out.help = true; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Color helpers — disabled on non-TTY and when NO_COLOR is set.
// ---------------------------------------------------------------------------

const COLOR_ENABLED = !!process.stdout.isTTY && !process.env.NO_COLOR;
const ANSI = { reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m" };
function c(code, s) { return COLOR_ENABLED ? `${code}${s}${ANSI.reset}` : s; }
const bold = (s) => c(ANSI.bold, s);
const dim  = (s) => c(ANSI.dim,  s);

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function pad(str, len) {
  return String(str).padEnd(len, " ").slice(0, len);
}

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

function printTable(items, { showScore = true, showWhy = false } = {}) {
  if (items.length === 0) {
    console.log("No results.");
    return;
  }
  const scoreW = 6, typeW = 10, slugW = 48, descW = showWhy ? 40 : 55;
  const header = showScore
    ? `${pad("Score", scoreW)}  ${pad("Type", typeW)}  ${pad("Slug", slugW)}  Description`
    : `${pad("Type", typeW)}  ${pad("Slug", slugW)}  Description`;
  const sep = "─".repeat(header.length + (showWhy ? 30 : 0));
  console.log(header);
  console.log(sep);
  for (const item of items) {
    const score = (typeof item._score === "number" ? item._score : typeof item.score === "number" ? item.score : null);
    const scoreStr = score !== null ? String(Math.round(score)).padStart(scoreW - 1) : " ".repeat(scoreW - 1);
    const type = pad(item.type || "", typeW);
    const slug = pad(truncate(item.slug || "", slugW), slugW);
    const desc = truncate(item.description || "", descW);
    if (showScore) {
      console.log(`${scoreStr}  ${type}  ${slug}  ${desc}`);
    } else {
      console.log(`${type}  ${slug}  ${desc}`);
    }
    if (showWhy && item._why) {
      console.log(`${"".padStart(scoreW + 2 + typeW + 2)}  ${"\x1b[2m"}${truncate(item._why, 100)}${"\x1b[0m"}`);
    }
  }
  console.log(`\n${items.length} result${items.length === 1 ? "" : "s"}`);
}

function printSources(sources) {
  if (sources.length === 0) { console.log("No sources found."); return; }
  const srcW = 40, countW = 6;
  const header = `${pad("Source", srcW)}  ${pad("Count", countW)}  Types`;
  console.log(header);
  console.log("─".repeat(header.length + 20));
  for (const s of sources) {
    const typeStr = Object.entries(s.types).map(([t, n]) => `${t}:${n}`).join(" ");
    console.log(`${pad(s.source, srcW)}  ${String(s.count).padStart(countW)}  ${typeStr}`);
  }
}

// ---------------------------------------------------------------------------
// Default-view widgets (bare invocation)
// ---------------------------------------------------------------------------

export function loadCliStats(repoRoot) {
  let version = "?";
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8"));
    version = pkg.version || "?";
  } catch { /* fall through */ }

  let catalog = { count: 0, sources: 0, source: null, mtime: null };
  const dataPath = join(repoRoot, "data.json");
  if (existsSync(dataPath)) {
    try {
      const parsed = JSON.parse(readFileSync(dataPath, "utf-8"));
      const items = Array.isArray(parsed) ? parsed : parsed.items ?? [];
      const sources = new Set(items.map((it) => it.source).filter(Boolean));
      catalog = {
        count: items.length,
        sources: sources.size,
        source: "data.json",
        mtime: statSync(dataPath).mtime,
      };
    } catch { /* parse error — leave defaults */ }
  }

  const routinesDir = join(repoRoot, "routines");
  let routines = 0;
  if (existsSync(routinesDir)) {
    try {
      routines = readdirSync(routinesDir).filter((f) => f.endsWith(".routine.json")).length;
    } catch { /* unreadable */ }
  }

  let currentTask = null;
  const tasksPath = join(repoRoot, ".agents", "TASKS.json");
  if (existsSync(tasksPath)) {
    try {
      const ledger = JSON.parse(readFileSync(tasksPath, "utf-8"));
      currentTask = ledger.current || null;
    } catch { /* malformed ledger */ }
  }

  return { version, catalog, routines, currentTask };
}

function formatFreshness(mtime) {
  if (!mtime) return "missing";
  const ageDays = (Date.now() - new Date(mtime).getTime()) / 86_400_000;
  if (ageDays < 1) return "fresh";
  if (ageDays < 7) return "recent";
  return "stale";
}

function formatMtime(mtime) {
  if (!mtime) return "—";
  const d = new Date(mtime);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function renderDefaultView(stats) {
  const { version, catalog, routines, currentTask } = stats;
  const task = currentTask ? currentTask : "—";
  const sepDot = dim("·");
  const strip = `${bold("skill-browser")} ${version}  ${sepDot}  ${catalog.count} items  ${sepDot}  ${catalog.sources} sources  ${sepDot}  ${routines} routines  ${sepDot}  task: ${task}`;
  const sep = dim("─".repeat(72));
  const footerSrc = catalog.source
    ? `${catalog.source} (${formatFreshness(catalog.mtime)})`
    : "no data.json — run `node build.mjs`";

  return [
    strip,
    sep,
    "",
    bold("SEARCH"),
    `  --goal "<text>"      rank by relevance`,
    `  --search "<text>"    full-text`,
    `  --get <slug>         single item`,
    "",
    bold("DISCOVER"),
    `  --sources            list sources`,
    `  --recipes            show saved routines`,
    `  --status             ledger + factory snapshot`,
    "",
    bold("ASSEMBLE"),
    `  --assemble "<goal>"  build a workspace ZIP`,
    `  --routine <id>       run a routine by id (routines/<id>.routine.json)`,
    "",
    bold("Options"),
    `  --type <t>  --limit <n>  --tier <t>  --json  --data <path>  --ai  --out <dir>`,
    `  --help               full reference`,
    "",
    dim(`Last updated  ${formatMtime(catalog.mtime)}  ${sepDot}  ${footerSrc}`),
  ].join("\n");
}

function printRecipes(repoRoot, asJson) {
  const dir = join(repoRoot, "routines");
  if (!existsSync(dir)) {
    if (asJson) { console.log("[]"); return; }
    console.log("No routines/ directory.");
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".routine.json")).sort();
  const parsed = files.map((f) => {
    try {
      const r = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      return {
        id: r.id ?? f.replace(/\.routine\.json$/, ""),
        title: r.title ?? "",
        cadence: r.cadence ?? "",
        steps: Array.isArray(r.steps) ? r.steps.length : 0,
        file: f,
      };
    } catch (e) {
      return { id: f, title: `(parse error: ${e.message})`, cadence: "", steps: 0, file: f };
    }
  });
  if (asJson) { console.log(JSON.stringify(parsed, null, 2)); return; }
  if (parsed.length === 0) { console.log("No routines on disk."); return; }
  console.log(bold("Routines") + dim(`  (${parsed.length})`));
  console.log(dim("─".repeat(72)));
  for (const r of parsed) {
    const id = pad(r.id, 28);
    const cadence = pad(r.cadence, 10);
    const steps = String(r.steps).padStart(2) + " steps";
    console.log(`  ${id}  ${cadence}  ${steps}  ${dim(r.title)}`);
  }
}

function printStatus(asJson) {
  const status = collectStatus(__dirname);
  if (asJson) { console.log(JSON.stringify(status, null, 2)); return; }
  const t = status.tasks;
  console.log(bold("Agentic Factory v1 — status"));
  console.log(dim(`Generated: ${status.generated_at}`));
  console.log("");
  console.log(`Catalog  : ${status.catalog.count} items  ${dim(`(${status.catalog.source || "missing"})`)}`);
  console.log(`Routines : ${status.routines.length} on disk`);
  for (const r of status.routines) {
    console.log(`  - ${r.id} ${dim(`(${r.cadence}, ${r.step_count} steps)`)} — ${r.title}`);
  }
  console.log("");
  console.log(`Tasks    : total=${t.total}  in_progress=${t.in_progress}  parked=${t.parked}  done=${t.done}  blocked=${t.blocked}`);
  console.log(`Current  : ${status.current_task || "(none)"}`);
}

function runAssemble(goal, opts) {
  const args = [join(__dirname, "assemble.mjs"), "--goal", goal, "--auto"];
  if (opts.tier)  args.push("--tier", opts.tier);
  if (opts.limit && opts.limit !== 10) args.push("--limit", String(opts.limit));
  if (opts.out)   args.push("--out", opts.out);
  if (opts.ai)    args.push("--ai");
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

function runRoutine(id) {
  const path = join(__dirname, "routines", `${id}.routine.json`);
  if (!existsSync(path)) {
    console.error(`Error: routine not found at ${path}`);
    console.error(`List available routines with: node cli.mjs --recipes`);
    process.exit(1);
  }
  const result = spawnSync(process.execPath, [join(__dirname, "routine-run.mjs"), path], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function usage() {
  console.log(`
skill-browser CLI — search, discover, and assemble Claude Code skills

Usage:
  node cli.mjs                       Show default dashboard view
  node cli.mjs --goal "<text>"       Rank skills by goal relevance
  node cli.mjs --search "<text>"     Full-text search the catalog
  node cli.mjs --get <slug>          Show a single skill by exact slug
  node cli.mjs --sources             List all catalog sources
  node cli.mjs --recipes             List saved routines
  node cli.mjs --status              Factory ledger + routine snapshot
  node cli.mjs --assemble "<goal>"   Build a workspace ZIP (delegates to assemble.mjs)
  node cli.mjs --routine <id>        Run routines/<id>.routine.json (delegates to routine-run.mjs)

Options:
  --type <type>    Filter by type: skill|command|agent|rule|workflow|all
  --limit <n>      Max results (default: 10)
  --tier <t>       Quality tier for --assemble: mvp|production|cutting-edge
  --out <dir>      Output dir for --assemble (default: ./out)
  --json           Output JSON instead of a formatted table
  --data <path>    Path to data.json (default: ./data.json)
  --ai             Use Groq/OpenRouter AI ranking (reads *_API_KEY env var)
  --help           Show this help message

Examples:
  node cli.mjs --goal "build a SaaS with auth and billing" --limit 15
  node cli.mjs --goal "review Python code" --ai       # requires GROQ_API_KEY
  node cli.mjs --search "python review" --type skill
  node cli.mjs --get /everything-claude-code:python-reviewer
  node cli.mjs --recipes --json
  node cli.mjs --assemble "review python for security" --tier production
  node cli.mjs --routine code-review-pipeline
`.trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    usage();
    process.exit(0);
  }

  const hasAction =
    opts.goal || opts.search || opts.get || opts.sources ||
    opts.recipes || opts.status || opts.assemble !== null || opts.routine;

  // Bare invocation → dashboard widgets
  if (!hasAction) {
    console.log(renderDefaultView(loadCliStats(__dirname)));
    process.exit(0);
  }

  // Read-only widgets that don't need the full catalog loaded
  if (opts.status) {
    printStatus(opts.json);
    return;
  }
  if (opts.recipes) {
    printRecipes(__dirname, opts.json);
    return;
  }

  // Subprocess wrappers
  if (opts.assemble !== null) {
    if (!opts.assemble) {
      console.error("Error: --assemble requires a goal string");
      process.exit(1);
    }
    runAssemble(opts.assemble, opts);
    return;
  }
  if (opts.routine) {
    runRoutine(opts.routine);
    return;
  }

  // The remaining actions need the catalog
  const dataPath = opts.data || join(__dirname, "data.json");
  if (!existsSync(dataPath)) {
    console.error(`Error: data.json not found at ${dataPath}\nRun: node build.mjs`);
    process.exit(1);
  }

  let catalog;
  try {
    const raw = readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    catalog = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  } catch (e) {
    console.error(`Error reading catalog: ${e.message}`);
    process.exit(1);
  }

  // --sources
  if (opts.sources) {
    const result = handleToolCall("list_sources", {}, catalog);
    if (result.error) { console.error(result.error.message); process.exit(1); }
    const sources = JSON.parse(result.content[0].text);
    if (opts.json) { console.log(JSON.stringify(sources, null, 2)); return; }
    printSources(sources);
    return;
  }

  // --get
  if (opts.get) {
    const result = handleToolCall("get_skill", { slug: opts.get }, catalog);
    if (result.error) { console.error(`Error: ${result.error.message}`); process.exit(1); }
    const item = JSON.parse(result.content[0].text);
    console.log(JSON.stringify(item, null, 2));
    return;
  }

  // --goal with --ai flag: use LLM ranking via GROQ_API_KEY env var
  if (opts.goal && opts.ai) {
    const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("Error: --ai requires GROQ_API_KEY or OPENROUTER_API_KEY environment variable");
      process.exit(1);
    }
    const provider = process.env.OPENROUTER_API_KEY ? "openrouter" : "groq";
    const client = LLMClient.create({ provider, apiKey });
    if (!opts.json) process.stderr.write("✨ AI ranking via Groq…\n");
    try {
      const ranked = await client.rankSkills(opts.goal, catalog);
      const items = ranked.slice(0, opts.limit).map(r => {
        const full = catalog.find(it => it.slug === r.slug);
        return full ? { ...full, _score: r.score, _why: r.reason } : r;
      });
      if (opts.json) { console.log(JSON.stringify(items, null, 2)); return; }
      printTable(items, { showScore: true, showWhy: true });
    } catch (err) {
      console.error(`AI ranking failed: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // --goal or --search (local offline ranking)
  const toolName = opts.goal ? "rank_skills_for_goal" : "search_skills";
  const toolArgs = opts.goal
    ? { goal: opts.goal, limit: opts.limit }
    : { query: opts.search, limit: opts.limit, ...(opts.type ? { type: opts.type } : {}) };

  const result = handleToolCall(toolName, toolArgs, catalog);
  if (result.error) { console.error(`Error: ${result.error.message}`); process.exit(1); }

  const items = JSON.parse(result.content[0].text);
  if (opts.json) { console.log(JSON.stringify(items, null, 2)); return; }
  printTable(items, { showScore: !!opts.goal });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
