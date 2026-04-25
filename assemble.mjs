#!/usr/bin/env node
/**
 * assemble.mjs — CLI Package Assembler
 *
 * Produces a workspace package (KICKOFF.md + CLAUDE.md + README.md, zipped)
 * with a mandatory Phase 0 Preflight Contract baked in. Mirrors the
 * assembler.html UI flow but headless, scriptable, and CI-friendly.
 *
 * Usage:
 *   node assemble.mjs --goal "your goal" [--tier mvp|production|cutting-edge]
 *                     [--limit 12] [--out ./out] [--ai] [--auto]
 *
 * --ai      reads GROQ_API_KEY (or OPENROUTER_API_KEY) and uses LLMClient
 *           for causal reranking on top of local IDF.
 * --auto    skip the interactive review prompt; proceed with top-N picks.
 *
 * Exit codes:
 *   0  success
 *   1  invalid args / no goal / no catalog
 *   2  ranking produced no usable picks
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

import {
  buildClaudeMd,
  buildReadme,
  buildKickoffWithPhase0,
  slugifyLabel,
  TIERS,
} from "./kickoff-template.mjs";
import { buildZip } from "./zip-builder.mjs";
import { LLMClient } from "./llm-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── ARG PARSING ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    goal: "",
    tier: "production",
    limit: 12,
    out: "./out",
    ai: false,
    auto: false,
    scenarioGate: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--ai") args.ai = true;
    else if (arg === "--auto") args.auto = true;
    else if (arg === "--goal") args.goal = argv[++i] ?? "";
    else if (arg === "--tier") args.tier = argv[++i] ?? "production";
    else if (arg === "--limit") args.limit = Number(argv[++i] ?? 12);
    else if (arg === "--out") args.out = argv[++i] ?? "./out";
    else if (arg === "--scenario-gate") args.scenarioGate = argv[++i] ?? null;
  }
  return args;
}

function printUsage() {
  console.log(`assemble — package CLI

Usage:
  node assemble.mjs --goal "your goal" [options]

Options:
  --goal <text>     Required. One-sentence description of what to build.
  --tier <name>     mvp | production | cutting-edge  (default: production)
  --limit <n>       Number of skills to select  (default: 12)
  --out <dir>       Output directory  (default: ./out)
  --ai              Use Groq/OpenRouter for causal ranking (reads GROQ_API_KEY)
  --auto            Skip interactive review; pick top-N automatically
  --scenario-gate <path>  Wire a scenario-factory dir as blind-eval gate
                          between chunks (e.g. --scenario-gate factory/v1).
                          Path must contain scenarios/runner.sh.
  --help, -h        Show this help

Examples:
  node assemble.mjs --goal "review python project for security" --tier production
  node assemble.mjs --goal "build CLI tool" --tier mvp --limit 8 --auto
  GROQ_API_KEY=gsk_... node assemble.mjs --goal "..." --ai --auto
`);
}

// ─── CATALOG LOADING ──────────────────────────────────────────────────────

function loadCatalog() {
  const dataJsonPath = join(__dirname, "data.json");
  if (existsSync(dataJsonPath)) {
    const raw = readFileSync(dataJsonPath, "utf-8");
    return JSON.parse(raw);
  }
  // Fallback to data.public.js (committed sanitized snapshot)
  const dataPubPath = join(__dirname, "data.public.js");
  if (existsSync(dataPubPath)) {
    const raw = readFileSync(dataPubPath, "utf-8");
    // data.public.js sets window.__ECC_DATA__ = {...}; — extract the JSON
    const m = raw.match(/__ECC_DATA__\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (m) return JSON.parse(m[1]);
  }
  return null;
}

// ─── LOCAL IDF RANKING (mirrors intent.mjs) ───────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "from", "into", "to",
  "of", "in", "on", "at", "by", "is", "it", "be", "as", "this", "that",
  "your", "my", "i", "we", "you", "they", "them", "these", "those",
]);

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function rankLocally(goal, items, limit) {
  const tokens = tokenize(goal);
  if (!tokens.length) return [];
  const docs = items.map((it) =>
    `${it.name || ""} ${it.description || ""} ${it.category || ""}`.toLowerCase()
  );
  const idf = {};
  for (const t of tokens) {
    const df = docs.reduce((a, d) => a + (d.includes(t) ? 1 : 0), 0);
    idf[t] = Math.log((items.length + 1) / (df + 1));
  }
  return items
    .map((it, i) => {
      const hay = docs[i];
      const matched = tokens.filter((t) => hay.includes(t));
      const score = matched.reduce((a, t) => a + idf[t], 0);
      return { item: it, score, matched };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── INTERACTIVE REVIEW ───────────────────────────────────────────────────

function prompt(question) {
  return new Promise((resolveP) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolveP(answer);
    });
  });
}

async function reviewPicks(picks, auto) {
  console.log("\n📋 Top picks:\n");
  picks.forEach((p, i) => {
    const slug = p.item.slug || p.item.name;
    const desc = (p.item.description || "").slice(0, 80);
    const score = p.score?.toFixed(2) ?? "?";
    console.log(`  ${(i + 1).toString().padStart(2)}. [${score}]  ${slug}`);
    if (desc) console.log(`        ${desc}`);
  });
  if (auto) {
    console.log("\n→ --auto: keeping all picks\n");
    return picks;
  }
  const answer = await prompt(
    "\nPress Enter to keep all, or type comma-separated numbers to KEEP only those (e.g. 1,3,5): "
  );
  const trimmed = answer.trim();
  if (!trimmed) return picks;
  const idx = trimmed.split(",").map((s) => Number(s.trim()) - 1).filter((n) => n >= 0 && n < picks.length);
  if (!idx.length) return picks;
  return idx.map((i) => picks[i]);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printUsage(); process.exit(0); }
  if (!args.goal) {
    console.error("Error: --goal is required.\n");
    printUsage();
    process.exit(1);
  }
  if (!TIERS.includes(args.tier)) {
    console.error(`Error: --tier must be one of ${TIERS.join(", ")}\n`);
    process.exit(1);
  }

  // Validate --scenario-gate if given: path must exist and contain scenarios/runner.sh
  if (args.scenarioGate) {
    const runnerPath = join(args.scenarioGate, "scenarios", "runner.sh");
    if (!existsSync(runnerPath)) {
      console.error(`Error: --scenario-gate "${args.scenarioGate}" missing required scenarios/runner.sh\n`);
      process.exit(1);
    }
    console.log(`🛡  Scenario gate: ${args.scenarioGate}`);
  }

  // 1. Load catalog
  const catalog = loadCatalog();
  if (!catalog || !Array.isArray(catalog.items) || !catalog.items.length) {
    console.error("Error: no catalog found. Run `node build.mjs` first.\n");
    process.exit(1);
  }
  console.log(`📚 Loaded ${catalog.items.length} items from catalog`);

  // 2. Local ranking (always — fast, deterministic, fallback)
  let picks = rankLocally(args.goal, catalog.items, args.limit);
  if (!picks.length) {
    console.error("Error: no skills matched the goal. Try a more descriptive --goal.\n");
    process.exit(2);
  }
  console.log(`🏎  Local ranker: ${picks.length} candidates`);

  // 3. AI causal rerank if requested
  if (args.ai) {
    const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn("⚠  --ai set but no GROQ_API_KEY / OPENROUTER_API_KEY in env — keeping local ranking");
    } else {
      const provider = process.env.GROQ_API_KEY ? "groq" : "openrouter";
      console.log(`✨ AI rerank via ${provider}…`);
      try {
        const client = LLMClient.create({ provider, apiKey });
        const aiResults = await client.rankSkills(args.goal, picks.map((p) => p.item));
        const bySlug = new Map(picks.map((p) => [p.item.slug, p]));
        const reranked = aiResults
          .map((r) => {
            const local = bySlug.get(r.slug);
            if (!local) return null;
            return { ...local, score: r.score ?? local.score, _why: r.reason, _confidence: r.confidence };
          })
          .filter(Boolean);
        if (reranked.length) {
          picks = reranked;
          console.log(`✨ AI rerank: ${picks.length} causal picks`);
        }
      } catch (err) {
        console.warn(`⚠  AI rerank failed (${err.message}) — keeping local ranking`);
      }
    }
  }

  // 4. Interactive review (skipped with --auto)
  picks = await reviewPicks(picks, args.auto);
  if (!picks.length) {
    console.error("Error: no picks remained after review.\n");
    process.exit(2);
  }

  // 5. Build artifacts
  const packageName = slugifyLabel(args.goal);
  const nodes = picks.map((p) => ({
    slug: p.item.slug,
    name: p.item.name,
    description: p.item.description || "",
    type: p.item.type || "skill",
  }));

  const kickoff = buildKickoffWithPhase0({
    goal: args.goal,
    description: "",
    packageName,
    nodes,
    tier: args.tier,
    chunkPlan: null, // operator fills in during 0.1–0.6 (Phase 0 step)
    gatePath: args.scenarioGate,
  });
  const claudeMd = buildClaudeMd({ nodes });
  const readme = buildReadme({ goal: args.goal, packageName, nodes });

  // 6. Bundle frameworks/ into the ZIP so the package is self-contained.
  // KICKOFF references frameworks/COMPOUND.md, frameworks/QUALITY_GATE.md, etc.
  // — those files must travel with the package or the contract breaks on extract.
  const frameworksDir = join(__dirname, "frameworks");
  const zipFiles = [
    { name: "KICKOFF.md", content: kickoff },
    { name: "CLAUDE.md", content: claudeMd },
    { name: "README.md", content: readme },
  ];
  if (existsSync(frameworksDir)) {
    const fwFiles = readdirSync(frameworksDir).filter((f) => f.endsWith(".md"));
    for (const f of fwFiles) {
      const content = readFileSync(join(frameworksDir, f), "utf-8");
      zipFiles.push({ name: `frameworks/${f}`, content });
    }
    console.log(`📦 Bundled ${fwFiles.length} framework files into package`);
  } else {
    console.warn("⚠  frameworks/ not found — KICKOFF references will be unresolved");
  }
  const zipBytes = buildZip(zipFiles);

  // 7. Write to disk
  const outDir = resolve(args.out);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${packageName}.zip`);
  writeFileSync(outPath, zipBytes);

  console.log(`\n✅ Package written: ${outPath}  (${(zipBytes.length / 1024).toFixed(1)} KB)`);
  console.log(`   ${nodes.length} skills · tier=${args.tier}`);
  console.log(`\nNext: extract the zip in your target workspace and complete Phase 0 in KICKOFF.md before building.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  console.error(err.stack);
  process.exit(1);
});
