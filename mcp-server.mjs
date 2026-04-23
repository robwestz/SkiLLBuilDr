#!/usr/bin/env node
// mcp-server.mjs — minimal production-grade MCP server over stdio
// Protocol: newline-delimited JSON-RPC 2.0
// Zero npm deps — Node built-ins only.
//
// Facts before write:
// 1. Callers: package.json bin.mcp entry point; tests/mcp-server.test.mjs imports handleToolCall/listTools
// 2. No existing file serves the same purpose (Glob: mcp*.mjs → no results)
// 3. Data shape: data.json → { items: [{slug, name, description, category, type, source, body?}] }
// 4. User instruction: "paus kan jag säga till om och tills dess får du gärna grinda!"

import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildKickoff, buildClaudeMd, buildReadme } from "./kickoff-template.mjs";
import { buildZip } from "./zip-builder.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// IDF-weighted token scoring (self-contained — avoids reading data.json twice
// and lets tests inject a synthetic catalog)
// ---------------------------------------------------------------------------

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

function buildIdf(items) {
  const df = new Map();
  const docs = items.map((it) => {
    const toks = new Set(tokenize(`${it.name} ${it.description || ""} ${it.category || ""}`));
    for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1);
    return toks;
  });
  const N = items.length || 1;
  const idf = new Map();
  for (const [t, f] of df) idf.set(t, Math.log((N + 1) / (f + 1)) + 1);
  return { idf, docs };
}

function scoreItem(it, queryTokens, doc, idf) {
  let s = 0;
  const name = it.name.toLowerCase();
  const nameTokens = new Set(tokenize(it.name));
  for (const q of queryTokens) {
    const w = idf.get(q) ?? 1;
    if (nameTokens.has(q)) s += 8 * w;
    else if (name.includes(q)) s += 4 * w;
    if (doc.has(q)) s += 2 * w;
  }
  return s;
}

function rankItems(query, items) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const { idf, docs } = buildIdf(items);
  return items
    .map((it, i) => ({ it, score: scoreItem(it, queryTokens, docs[i], idf) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ it, score }) => ({ ...it, score: Math.round(score * 10) / 10 }));
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: "search_skills",
    description: "Search the skill catalog by query text, with optional type filter.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results (default 10)" },
        type: {
          type: "string",
          enum: ["skill", "command", "agent", "rule", "workflow", "all"],
          description: "Filter by type (default: all)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "rank_skills_for_goal",
    description: "Rank all catalog items by IDF relevance to a goal.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The goal to rank skills for" },
        limit: { type: "number", description: "Max results (default 15)" },
      },
      required: ["goal"],
    },
  },
  {
    name: "get_skill",
    description: "Retrieve a single skill by exact slug.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Exact slug of the skill" },
      },
      required: ["slug"],
    },
  },
  {
    name: "assemble_package",
    description: "Assemble a ZIP package (base64) from selected skill slugs.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "Goal for the package" },
        description: { type: "string", description: "Optional longer description" },
        slugs: {
          type: "array",
          items: { type: "string" },
          description: "Array of skill slugs to include",
        },
      },
      required: ["goal", "slugs"],
    },
  },
  {
    name: "list_sources",
    description: "List unique sources in the catalog with item counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers — accept catalog as parameter so tests can inject synthetic data
// ---------------------------------------------------------------------------

export function listTools() {
  return TOOL_DEFINITIONS;
}

export function handleToolCall(name, args, catalog) {
  switch (name) {
    case "search_skills": {
      if (!args || typeof args.query !== "string") {
        return { error: { code: -32602, message: "Missing required parameter: query" } };
      }
      const limit = typeof args.limit === "number" ? args.limit : 10;
      const type = args.type && args.type !== "all" ? args.type : null;
      const pool = type ? catalog.filter((it) => it.type === type) : catalog;
      const ranked = rankItems(args.query, pool).slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(ranked) }] };
    }

    case "rank_skills_for_goal": {
      if (!args || typeof args.goal !== "string") {
        return { error: { code: -32602, message: "Missing required parameter: goal" } };
      }
      const limit = typeof args.limit === "number" ? args.limit : 15;
      const ranked = rankItems(args.goal, catalog).slice(0, limit);
      return { content: [{ type: "text", text: JSON.stringify(ranked) }] };
    }

    case "get_skill": {
      if (!args || typeof args.slug !== "string") {
        return { error: { code: -32602, message: "Missing required parameter: slug" } };
      }
      const item = catalog.find((it) => it.slug === args.slug);
      if (!item) {
        return { error: { code: -32603, message: `Skill not found: ${args.slug}` } };
      }
      return { content: [{ type: "text", text: JSON.stringify(item) }] };
    }

    case "assemble_package": {
      if (!args || typeof args.goal !== "string") {
        return { error: { code: -32602, message: "Missing required parameter: goal" } };
      }
      if (!Array.isArray(args.slugs)) {
        return { error: { code: -32602, message: "Missing required parameter: slugs" } };
      }
      const nodes = args.slugs
        .map((slug) => catalog.find((it) => it.slug === slug))
        .filter(Boolean);

      let kickoffContent, claudeMdContent, readmeContent;
      try {
        kickoffContent = buildKickoff({
          goal: args.goal,
          description: args.description || "",
          nodes,
        });
        claudeMdContent = buildClaudeMd({ nodes });
        readmeContent = buildReadme({
          goal: args.goal,
          description: args.description || "",
          nodes,
        });
      } catch (err) {
        return { error: { code: -32603, message: err.message } };
      }

      const files = [
        { name: "KICKOFF.md", content: kickoffContent },
        { name: "CLAUDE.md", content: claudeMdContent },
        { name: "README.md", content: readmeContent },
      ];

      let zipBytes;
      try {
        zipBytes = buildZip(files);
      } catch (err) {
        return { error: { code: -32603, message: err.message } };
      }

      const base64zip = Buffer.from(zipBytes).toString("base64");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ base64zip, files: files.map((f) => f.name) }),
          },
        ],
      };
    }

    case "list_sources": {
      const sourceMap = new Map();
      for (const it of catalog) {
        const src = it.source || "(unknown)";
        if (!sourceMap.has(src)) {
          sourceMap.set(src, { source: src, count: 0, types: {} });
        }
        const entry = sourceMap.get(src);
        entry.count += 1;
        const t = it.type || "unknown";
        entry.types[t] = (entry.types[t] ?? 0) + 1;
      }
      const sources = Array.from(sourceMap.values()).sort((a, b) => b.count - a.count);
      return { content: [{ type: "text", text: JSON.stringify(sources) }] };
    }

    default:
      return { error: { code: -32601, message: `Tool not found: ${name}` } };
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function makeResult(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n";
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n";
}

// ---------------------------------------------------------------------------
// Main server loop — only runs when this is the entry point
// ---------------------------------------------------------------------------

function startServer() {
  // Parse --data <path> CLI arg
  let dataPath = join(__dirname, "data.json");
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--data" && argv[i + 1]) {
      dataPath = argv[++i];
    }
  }

  // Load catalog once at startup
  let catalog;
  try {
    const raw = readFileSync(dataPath, "utf8");
    const parsed = JSON.parse(raw);
    catalog = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  } catch (err) {
    process.stderr.write(
      `mcp-server: failed to load catalog from ${dataPath}: ${err.message}\n`
    );
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request;
    try {
      request = JSON.parse(trimmed);
    } catch {
      process.stdout.write(makeError(null, -32700, "Parse error"));
      return;
    }

    const { id, method, params } = request;

    // Notifications have no id — send no response
    if (method === "notifications/initialized") return;

    if (method === "initialize") {
      process.stdout.write(
        makeResult(id, {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "skill-browser", version: "0.7.0" },
          capabilities: { tools: {} },
        })
      );
      return;
    }

    if (method === "tools/list") {
      process.stdout.write(makeResult(id, { tools: listTools() }));
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};

      if (!toolName) {
        process.stdout.write(makeError(id, -32602, "Missing required parameter: name"));
        return;
      }

      const outcome = handleToolCall(toolName, toolArgs, catalog);

      if (outcome.error) {
        process.stdout.write(makeError(id, outcome.error.code, outcome.error.message));
      } else {
        process.stdout.write(makeResult(id, outcome));
      }
      return;
    }

    // Unknown method
    process.stdout.write(makeError(id, -32601, `Method not found: ${method}`));
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
