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

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handleToolCall } from "./mcp-server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { goal: null, search: null, get: null, sources: false, type: null, limit: 10, json: false, data: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--goal")        { out.goal = argv[++i]; }
    else if (a === "--search") { out.search = argv[++i]; }
    else if (a === "--get")    { out.get = argv[++i]; }
    else if (a === "--sources") { out.sources = true; }
    else if (a === "--type")   { out.type = argv[++i]; }
    else if (a === "--limit")  { out.limit = parseInt(argv[++i], 10) || 10; }
    else if (a === "--json")   { out.json = true; }
    else if (a === "--data")   { out.data = argv[++i]; }
    else if (a === "--help" || a === "-h") { out.help = true; }
  }
  return out;
}

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

function printTable(items, { showScore = true } = {}) {
  if (items.length === 0) {
    console.log("No results.");
    return;
  }
  const scoreW = 6, typeW = 10, slugW = 48, descW = 55;
  const header = showScore
    ? `${pad("Score", scoreW)}  ${pad("Type", typeW)}  ${pad("Slug", slugW)}  Description`
    : `${pad("Type", typeW)}  ${pad("Slug", slugW)}  Description`;
  const sep = "─".repeat(header.length);
  console.log(header);
  console.log(sep);
  for (const item of items) {
    const score = typeof item.score === "number" ? String(Math.round(item.score)).padStart(scoreW - 1) : "";
    const type = pad(item.type || "", typeW);
    const slug = pad(truncate(item.slug || "", slugW), slugW);
    const desc = truncate(item.description || "", descW);
    if (showScore) {
      console.log(`${score}  ${type}  ${slug}  ${desc}`);
    } else {
      console.log(`${type}  ${slug}  ${desc}`);
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
// Usage
// ---------------------------------------------------------------------------

function usage() {
  console.log(`
skill-browser CLI — search and assemble Claude Code skills

Usage:
  node cli.mjs --goal "<text>"     Rank skills by goal relevance
  node cli.mjs --search "<text>"   Full-text search the catalog
  node cli.mjs --get <slug>        Show a single skill by exact slug
  node cli.mjs --sources           List all catalog sources

Options:
  --type <type>    Filter by type: skill|command|agent|rule|workflow|all
  --limit <n>      Max results (default: 10)
  --json           Output JSON instead of a formatted table
  --data <path>    Path to data.json (default: ./data.json)
  --help           Show this help message

Examples:
  node cli.mjs --goal "build a SaaS with auth and billing" --limit 15
  node cli.mjs --search "python review" --type skill
  node cli.mjs --get /everything-claude-code:python-reviewer
  node cli.mjs --sources --json
`.trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help || (!opts.goal && !opts.search && !opts.get && !opts.sources)) {
    usage();
    process.exit(0);
  }

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

  // --goal or --search
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

main();
