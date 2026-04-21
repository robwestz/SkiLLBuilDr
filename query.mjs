#!/usr/bin/env node
// Query the ECC data.json by search terms, type, and category.
// Usage:
//   node query.mjs [terms...] [--type skill|command|all] [--category <cat>] [--limit N] [--format tsv|json]
//   node query.mjs --list-categories

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");

function ensureData() {
  if (existsSync(DATA)) return;
  const r = spawnSync(process.execPath, [join(__dirname, "build.mjs")], {
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error("build.mjs failed, cannot query");
    process.exit(2);
  }
}

function parseArgs(argv) {
  const opts = {
    terms: [],
    type: "all",
    scope: null,
    source: null,
    category: null,
    limit: 50,
    format: "tsv",
    listCategories: false,
    listSources: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type") opts.type = argv[++i];
    else if (a === "--scope") opts.scope = argv[++i];
    else if (a === "--source") opts.source = argv[++i];
    else if (a === "--category") opts.category = argv[++i];
    else if (a === "--limit") opts.limit = parseInt(argv[++i], 10) || 50;
    else if (a === "--format") opts.format = argv[++i];
    else if (a === "--list-categories") opts.listCategories = true;
    else if (a === "--list-sources") opts.listSources = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else opts.terms.push(a);
  }
  return opts;
}

function usage() {
  console.log(`Usage: node query.mjs [terms...] [options]

Options:
  --type skill|command|all      Filter by type (default: all)
  --scope plugin|user|project   Filter by scope
  --source <label>              Filter by source label (e.g. plugin:posthog, user)
  --category <name>             Filter by category (see --list-categories)
  --limit N                     Max results (default: 50)
  --format tsv|json             Output format (default: tsv)
  --list-categories             Show categories with counts
  --list-sources                Show sources with counts
  -h, --help                    Show this help

Examples:
  node query.mjs kotlin testing
  node query.mjs --type command review
  node query.mjs --source plugin:posthog
  node query.mjs --scope user --format json
  node query.mjs --category Security --limit 20`);
}

function score(it, tokens) {
  let s = 0;
  const name = it.name.toLowerCase();
  const desc = (it.description || "").toLowerCase();
  for (const t of tokens) {
    if (name === t) s += 10;
    else if (name.startsWith(t)) s += 6;
    else if (name.includes(t)) s += 3;
    if (desc.includes(t)) s += 1;
  }
  return s;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();

  ensureData();
  const data = JSON.parse(readFileSync(DATA, "utf8"));

  if (opts.listCategories) {
    const entries = Object.entries(data.categories).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of entries) {
      console.log(`${String(count).padStart(4)}  ${cat}`);
    }
    return;
  }

  if (opts.listSources) {
    const entries = Object.entries(data.sourcesCount || {}).sort((a, b) => b[1] - a[1]);
    for (const [src, count] of entries) {
      console.log(`${String(count).padStart(4)}  ${src}`);
    }
    return;
  }

  const q = opts.terms.join(" ").toLowerCase().trim();
  const tokens = q ? q.split(/\s+/) : [];

  let results = data.items.filter((it) => {
    if (opts.type !== "all" && it.type !== opts.type) return false;
    if (opts.scope && it.scope !== opts.scope) return false;
    if (opts.source && it.source !== opts.source) return false;
    if (opts.category && it.category !== opts.category) return false;
    if (tokens.length === 0) return true;
    const hay = (it.name + " " + it.description + " " + it.category + " " + (it.source || "")).toLowerCase();
    return tokens.every((t) => hay.includes(t));
  });

  if (tokens.length > 0) {
    results.sort((a, b) => score(b, tokens) - score(a, tokens));
  }

  results = results.slice(0, opts.limit);

  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
  } else {
    for (const it of results) {
      const desc = (it.description || "").replace(/\s+/g, " ").slice(0, 200);
      process.stdout.write(
        [it.type, it.slug, it.source || "", it.category, desc].join("\t") + "\n"
      );
    }
    if (results.length === 0) {
      process.stderr.write("No matches.\n");
    } else {
      process.stderr.write(`(${results.length} result${results.length === 1 ? "" : "s"})\n`);
    }
  }
}

main();
