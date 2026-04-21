#!/usr/bin/env node
// Natural-language intent matcher. Takes a free-text description of what the
// user wants to do, returns ranked skills/commands from the full catalog.
// Pure local: token overlap + IDF + category boost. No API calls.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "data.json");

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from",
  "has", "have", "i", "if", "in", "is", "it", "its", "me", "my", "of", "on",
  "or", "our", "so", "that", "the", "their", "them", "then", "there", "they",
  "this", "to", "up", "was", "we", "were", "what", "when", "where", "which",
  "while", "will", "with", "you", "your", "want", "need", "should", "would",
  "can", "could", "how", "make", "get", "help", "please", "just", "some",
  "something", "thing", "things", "use", "using",
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s+/#.-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function parseArgs(argv) {
  const out = { text: [], limit: 10, format: "text", type: "all", scope: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = parseInt(argv[++i], 10) || 10;
    else if (a === "--format") out.format = argv[++i];
    else if (a === "--type") out.type = argv[++i];
    else if (a === "--scope") out.scope = argv[++i];
    else if (a === "--help" || a === "-h") { out.help = true; }
    else out.text.push(a);
  }
  return out;
}

function usage() {
  console.log(`Usage: node intent.mjs "<description of what you want to do>" [options]

Options:
  --limit N                      Max results (default: 10)
  --format text|json|tsv         Output format (default: text)
  --type skill|command|all       Filter by type
  --scope plugin|user|project    Filter by scope
  -h, --help                     This help

Examples:
  node intent.mjs "review python code and add tests"
  node intent.mjs "onboard an unfamiliar repo" --limit 5
  node intent.mjs "set up analytics for my app" --format json`);
}

function ensureData() {
  if (existsSync(DATA)) return;
  const r = spawnSync(process.execPath, [join(__dirname, "build.mjs")], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("build.mjs failed; cannot compute intent matches.");
    process.exit(2);
  }
}

function buildIdf(items) {
  const df = new Map();
  const docs = items.map((it) => {
    const toks = new Set(tokenize(`${it.name} ${it.description || ""} ${it.category || ""}`));
    for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1);
    return toks;
  });
  const N = items.length;
  const idf = new Map();
  for (const [t, f] of df) idf.set(t, Math.log((N + 1) / (f + 1)) + 1);
  return { idf, docs };
}

function scoreItem(it, queryTokens, doc, idf) {
  let s = 0;
  const name = it.name.toLowerCase();
  const nameTokens = tokenize(it.name);
  const nameSet = new Set(nameTokens);

  for (const q of queryTokens) {
    const w = idf.get(q) ?? 1;
    if (nameSet.has(q)) s += 8 * w;
    else if (name.includes(q)) s += 4 * w;
    if (doc.has(q)) s += 2 * w;
  }

  const cat = (it.category || "").toLowerCase();
  const textBlob = queryTokens.join(" ");
  const catBoosts = [
    [["test", "testing", "tdd", "coverage", "unit", "e2e"], /testing/, 6],
    [["review", "audit"], /review|audit/, 5],
    [["secur", "auth", "authenticat", "vulnerab", "exploit"], /security/, 7],
    [["plan", "roadmap", "spec", "phase"], /planning|agents/, 4],
    [["deploy", "docker", "kubernetes", "ci", "cd", "pipeline"], /devops/, 5],
    [["frontend", "ui", "ux", "accessib", "component", "design"], /frontend|design/, 5],
    [["database", "sql", "query", "schema", "migrat", "postgres"], /^data/, 5],
    [["python", "django"], /python/, 6],
    [["kotlin", "android"], /kotlin\/android/, 6],
    [["rust"], /^rust$/, 6],
    [["go "], /^go$/, 6],
    [["cpp", "c++"], /c\+\+/, 6],
    [["llm", "ai", "model", "prompt", "agent"], /agents|ai ops|ecc-meta/, 5],
    [["post", "publish", "article", "blog", "video"], /content/, 5],
    [["onboard", "unfamiliar", "new code"], /agents|architecture|planning/, 4],
  ];
  for (const [terms, catRe, bonus] of catBoosts) {
    const matchesIntent = terms.some((t) => textBlob.includes(t));
    if (!matchesIntent) continue;
    if (catRe.test(cat)) s += bonus;
  }

  if (textBlob.includes("review")) {
    if (name.endsWith("-review") || name.endsWith("review")) s += 3;
  }
  if (textBlob.includes("build") || textBlob.includes("fix")) {
    if (name.endsWith("-build")) s += 3;
  }

  return s;
}

function why(it, queryTokens) {
  const name = it.name.toLowerCase();
  const hits = [];
  for (const q of queryTokens) {
    if (name.includes(q)) hits.push(`name:${q}`);
    else if ((it.description || "").toLowerCase().includes(q)) hits.push(`desc:${q}`);
    else if ((it.category || "").toLowerCase().includes(q)) hits.push(`cat:${q}`);
  }
  return hits.slice(0, 4).join(" · ");
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || opts.text.length === 0) return usage();

  ensureData();
  const data = JSON.parse(readFileSync(DATA, "utf8"));

  let items = data.items;
  if (opts.type !== "all") items = items.filter((i) => i.type === opts.type);
  if (opts.scope) items = items.filter((i) => i.scope === opts.scope);

  const query = opts.text.join(" ");
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    console.error("No meaningful tokens in query (after stopword removal).");
    process.exit(1);
  }

  const { idf, docs } = buildIdf(items);
  const scored = items
    .map((it, i) => ({ it, score: scoreItem(it, queryTokens, docs[i], idf) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit)
    .map(({ it, score }) => ({ ...it, _score: Math.round(score * 10) / 10, _why: why(it, queryTokens) }));

  if (opts.format === "json") {
    process.stdout.write(JSON.stringify(scored, null, 2) + "\n");
    return;
  }
  if (opts.format === "tsv") {
    for (const it of scored) {
      const desc = (it.description || "").replace(/\s+/g, " ").slice(0, 160);
      process.stdout.write(
        [it._score, it.type, it.slug, it.source || "", it.category, desc].join("\t") + "\n"
      );
    }
    return;
  }

  process.stdout.write(`Query: "${query}"\n`);
  process.stdout.write(`Tokens: ${queryTokens.join(", ")}\n\n`);
  if (scored.length === 0) {
    process.stdout.write("No matches found. Try different words.\n");
    return;
  }
  scored.forEach((it, i) => {
    const rank = String(i + 1).padStart(2, " ");
    const slug = it.slug.padEnd(48);
    process.stdout.write(`${rank}.  [${it.type}] ${slug}  (score ${it._score})\n`);
    process.stdout.write(`     ${it.source}  ·  ${it.category}\n`);
    if (it._why) process.stdout.write(`     match: ${it._why}\n`);
    const desc = (it.description || "").replace(/\s+/g, " ").slice(0, 160);
    if (desc) process.stdout.write(`     ${desc}\n`);
    process.stdout.write("\n");
  });
}

main();
