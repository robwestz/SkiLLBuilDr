# Week Plan: buildr.nu v0.7.0
> Authored: 2026-04-23 — strategic roadmap for the sprint toward paid product launch

## North Star
> Användaren beskriver vad de vill bygga. En agent på buildr.nu väljer ut och sätter ihop ett komplett workspace-paket. Användaren laddar ner paketet, öppnar sin IDE, pekar sin agent på startfilen. ~24 timmar senare levererar de en produkt värd 200k SEK till kund. Tjänsten är värd 100 000 kr/månad och ändå en deal.

**Go-live condition:** Package Assembler works hosted, with LLM-enhanced skill selection, at buildr.nu.

---

## Strategic Observations (findings before planning)

**1. Hosting is blocked by absolute paths in data.json.**
`build.mjs` embeds `C:\Users\robin\.claude\plugins\cache\...` paths on every item. A hosted version served from buildr.nu would expose local machine structure and break on any other machine. Fix: `build.mjs --sanitize` is Day 1, non-negotiable.

**2. MCP server is a better distribution vector than npm.**
An npm module requires a terminal window outside Claude. An MCP server *lives inside Claude* — every session with it installed gets `search_skills`, `assemble_package`, `rank_skills_for_goal` natively. Adoption surface is fundamentally different: the user never leaves Claude Code to use the tool.

**3. Semantic embeddings beat Groq for the offline tier.**
Build-time embeddings via `@xenova/transformers` (runs in Node, no Python, quantized all-MiniLM-L6-v2, ~22MB cached) give dramatically better semantic matching than IDF — "deploy microservice" hits "kubernetes-reviewer" — at zero runtime cost and zero API key. Groq and Haiku are the premium *enrichment* layer on top of good offline results, not a replacement for them.

**4. Don't sell LLM access — sell curation, templates, and team features.**
Users bring their own API keys (Groq is free tier, OpenRouter is pay-as-you-go). buildr.nu's premium value is the 744-item curated catalog, pre-built templates that actually work, and team collaboration. Competing on API margins is a race to the bottom.

**5. Three tiers of skill matching create visible product quality.**
```
Tier 1 — Instant (<50ms):   Token IDF      [existing, always runs]
Tier 2 — Semantic (~500ms): Embeddings     [new Day 2, offline, free]
Tier 3 — AI (~1-2s):        Groq/Haiku LLM [new Day 1, opt-in, own key]
```
The UI shows results *updating progressively*. Each tier is visibly better. Zero forced upgrade path.

---

## Week Architecture: Pipeline + Map-Reduce

```
DAY 1         DAY 2         DAY 3         DAY 4         DAY 5
Foundation    Semantic      MCP +         Templates +   Deploy +
+ LLM arch    upgrade +     npm dist      tech debt     Launch
              Groq UI
   │              │              │              │              │
GATE 1:       GATE 2:       GATE 3:       GATE 4:       GATE 5:
llm-client    semantic >    MCP works     110+ tests    buildr.nu
tests green   IDF on 3      in Claude     green         live
              test queries  Desktop
```

Orchestration pattern: **Pipeline** (sequential days with gates) + **Map-Reduce** within each day (parallel workers, aggregated at day-end) + **Reflection** at gates (critic reviews before proceeding).

---

## DAY 1 — Foundation: Sanitized Build + LLM Client Architecture

### Track A: build.mjs --sanitize (hosting blocker fix)

`data.json` currently embeds absolute Windows paths on every item. Fix with `--sanitize` flag:

```js
// build.mjs — add to item post-processing
if (args.sanitize) {
  item.filePath = undefined;                      // remove machine-specific path
  item.source = toCanonicalSource(item.source);  // "C:\...\posthog" → "plugin:posthog"
}

function toCanonicalSource(rawSource) {
  // Extract plugin name from path, normalize to "plugin:<name>", "user", or "project"
  if (!rawSource) return "unknown";
  if (rawSource.includes("plugins")) {
    const match = rawSource.match(/plugins[/\\](?:cache[/\\])?([^/\\]+)/);
    return match ? `plugin:${match[1]}` : "plugin:unknown";
  }
  if (rawSource.includes(".claude") && !rawSource.includes("plugins")) return "user";
  return "project";
}
```

Also add `--hosted` flag to `bundle.mjs`: generates slim HTML that fetches `data.json` from a CDN URL instead of inlining it, keeping `dist/skill-browser.html` at ~50KB instead of 5.8MB.

### Track B: llm-client.mjs — provider-agnostic LLM wrapper

**The interface is the contract. Providers are swappable.**

```js
// llm-client.mjs — ESM, zero external deps beyond fetch
export class LLMClient {
  static async create(provider, apiKey, options = {})

  // Three operations, each optimized for its task:
  async rankSkills(goal, catalogItems, { limit = 12 } = {})
    // → [{slug, score, reason, confidence}]
    // Fast model (Llama-3-8B on Groq): ~400ms, cheap

  async buildPackageContext(goal, description, selectedSkills)
    // → {summary, risks, firstMoves, estimatedHours}
    // Deep model (Llama-70B): ~2-3s, runs once per package assembly

  async validatePackage(pkg)
    // → {complete: bool, gaps: string[], suggestions: string[]}
    // Premium feature: post-assembly quality check
}

class GroqProvider extends LLMClient {
  // CORS-enabled, free tier (14,400 req/day), immediate
  // fastModel: "llama3-8b-8192" for rankSkills
  // deepModel: "llama-3.3-70b-versatile" for buildPackageContext
}

class OpenRouterProvider extends LLMClient {
  // CORS-enabled, pay-as-you-go, 100+ models
}

class AnthropicProxyProvider extends LLMClient {
  // Requires edge function proxy (CORS issue with direct browser calls)
  // Premium option: Claude Haiku for chain-of-thought package context
}
```

System prompt for `rankSkills` is adapted from `workspace-buildr-proto/prompts/rank-skills.md` — emphasizes **causal** reasoning ("this skill causes the desired outcome") over **associative** matching.

### Track C: Assembler settings UI + progressive enhancement

**Settings modal (⚙ in assembler topbar):**
- Provider select: Groq (free) | OpenRouter | Anthropic
- API key (type=password, `localStorage["assembler-llm-v1"]`, never sent to buildr.nu servers)
- "Test connection" → minimal ping
- "Clear key" → removes from localStorage

**Progressive enhancement in assembler Step 2:**
```
User clicks "Next" in Step 1
  → Local IDF results appear immediately (<50ms)         [existing]
  → Embedding rerank after 500ms (if embeddings present) [Day 2]
  → LLM enrichment after ~1-2s (if API key set)          [Day 1]
    → Skills updated with ✨ badge
    → Tooltip: "Selected because: CI/CD pipelines require container orchestration"
```

### Reflection at Gate 1:
Security critic checks:
- API key never appears in any log output
- API key not sent to any buildr.nu endpoint (no backend exists yet)
- localStorage key is namespaced to avoid collision
- Error messages don't expose the key

### Tests (Gate 1 requirement):
`tests/llm-client.test.mjs` — 15+ tests:
- Mock Groq responses (use `globalThis.fetch` mock)
- API key save/load/clear cycle
- Fallback to local IDF when API call fails
- `rankSkills` response parsing
- `buildPackageContext` response parsing
- Provider factory (`LLMClient.create(...)` with unknown provider throws)
- Rate limit handling (429 response → graceful message, not exception)

---

## DAY 2 — Semantic Upgrade: Build-time Embeddings

### The core innovation

IDF scoring is fast but semantically shallow. `"deploy microservice"` doesn't score `"kubernetes-reviewer"` or `"docker-build-resolver"` because those words don't appear in the query. Real user language doesn't map to skill names.

Solution: **384-dimensional sentence embeddings generated at build time, cosine similarity in browser — fully offline, zero runtime API cost.**

```
build.mjs (Node, at build time)         browser (runtime)
─────────────────────────────────       ─────────────────────────────────
@xenova/transformers                    data.js contains Float32[384] per skill
all-MiniLM-L6-v2 quantized              Transformers.js loaded lazily
~22MB one-time download (cached)        Query embedded on first search (~1.5s)
~30s for 744 items                      Each similarity: <1ms
~1.5MB added to data.js                 Subsequent queries: <5ms
```

**build.mjs --embeddings:**
```js
if (args.embeddings) {
  const { pipeline } = await import("@xenova/transformers");
  const extractor = await pipeline("feature-extraction",
    "Xenova/all-MiniLM-L6-v2",
    { quantized: true }
  );
  for (const item of items) {
    const text = `${item.name} ${item.description || ""} ${item.category || ""}`;
    const out = await extractor([text], { pooling: "mean", normalize: true });
    item.embedding = Array.from(out.data); // Float32[384]
  }
}
```

**Browser cosine similarity:**
```js
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
```

**Tier UI in assembler Step 2 (visual progression):**
```
🏎 Instant   | Token IDF — 12 results, ranked by keyword overlap
🧠 Semantic  | Embedding similarity — same results, reranked (badge: "Semantic")
✨ AI        | LLM-enriched — top 8 from LLM with causal reasoning (badge: "AI")
```

The user *watches* quality improve. This is the product's core quality signal.

### Quality benchmark queries (Gate 2 validation):
Test these manually after Day 2:
1. `"deploy microservice"` → must surface: kubernetes-reviewer, docker-build-resolver
2. `"review go code"` → must surface: go-reviewer, go-build-resolver
3. `"set up analytics"` → must surface: posthog-setup (recipe), analytics-related skills
4. `"onboard unfamiliar codebase"` → must surface: planner, architect, doc-updater

IDF comparison: record IDF rank for each vs embedding rank. Embedding must win on at least 3/4.

---

## DAY 3 — MCP Server: Skill Browser as a Claude Extension

### Architecture

```js
// mcp-server.mjs — Node ESM, single file
// Dependency: @modelcontextprotocol/sdk (official MCP SDK)

const server = new MCPServer({
  name: "skill-browser",
  version: "0.7.0",
  description: "Search, rank, and assemble Claude Code skills from the local catalog",
});
```

**Five tools:**

| Tool | Input | Output | Use case |
|---|---|---|---|
| `search_skills` | query, type?, category?, limit? | [{slug, name, description, score}] | Find a skill you know exists |
| `rank_skills_for_goal` | goal, limit? | [{slug, name, reason, score}] | Discover skills for a task |
| `get_skill` | slug | {name, slug, body, category, source} | Read full skill before using it |
| `assemble_package` | goal, description?, skills? | {kickoff, claudeMd, workflowYaml, readme} | Build a workspace package |
| `list_sources` | — | [{id, name, type, itemCount}] | Understand what's installed |

`assemble_package` is the star tool. An agent can call it mid-session to get a fully formatted KICKOFF.md without ever leaving the terminal or opening a browser.

**Installation (one-liner in README):**
```json
// ~/.claude/mcp.json
{
  "mcpServers": {
    "skill-browser": {
      "command": "node",
      "args": ["C:/Users/robin/.claude/ecc-browser/mcp-server.mjs"]
    }
  }
}
```

With npx (after npm publish):
```json
{
  "mcpServers": {
    "skill-browser": {
      "command": "npx",
      "args": ["-y", "skill-browser", "--mcp"]
    }
  }
}
```

### cli.mjs — unified CLI entry

```js
#!/usr/bin/env node
// cli.mjs — entry point for `npx skill-browser` and `skill-browser` bin
const cmd = process.argv[2];
if (cmd === "--mcp")      import("./mcp-server.mjs").then(m => m.start());
else if (cmd === "query") import("./query.mjs");
else if (cmd === "intent") import("./intent.mjs");
else                       import("./launch-node.mjs"); // build + open browser
```

`launch-node.mjs` — cross-platform version of `launch.sh` (Node instead of bash, works on Windows without WSL).

### Tests (Gate 3):
`tests/mcp-server.test.mjs` — 12+ tests:
- Server starts and responds to `initialize`
- Each tool: valid input → valid output shape
- `search_skills` with no results returns empty array (not error)
- `assemble_package` returns all four file fields
- Error handling for bad slug in `get_skill`

---

## DAY 4 — Template Library + Technical Debt

### Package templates in recipes.json

Six templates with `packageTemplate: true`:

```json
{
  "id": "saas-mvp",
  "title": "SaaS MVP",
  "description": "Next.js SaaS with auth, database, billing, and onboarding flow",
  "packageTemplate": true,
  "estimatedHours": 20,
  "profile": "saas",
  "icon": "🚀",
  "slugs": ["...8-10 skills..."],
  "steps": ["...8 execution steps..."]
}
```

Templates: `saas-mvp` (20h), `cli-tool` (8h), `api-service` (12h), `ai-agent` (16h), `data-pipeline` (14h), `mobile-app` (24h).

**Assembler Step 1 template section:**
Above the goal textarea: "Start from a template" with template cards.
Each card: icon, title, description, estimated hours badge, "Use this template →" button.
Click: fills `goalInput` + pre-selects skills in Step 2 → jumps to Step 2 automatically.

### Technical debt (circuit-breaker — skip if blocked, log for next sprint)

Priority order:

1. **Settings modal in index.html** — ⚙ button exists, opens nothing. Wire it up with: theme toggle, analytics opt-in, clear data. Use same modal pattern as assembler.html settings.

2. **playground.html E2E tests** — `tests/e2e/playground.spec.js`:
   - Load playground, catalog loads
   - Add skill node from catalog
   - Reorder nodes (drag or button)
   - Export as YAML → modal opens
   - Save workflow → appears in saved list

3. **intent.mjs edge case tests** — 8 tests:
   - Empty catalog → returns []
   - Empty query → returns []
   - Single character query → no crash
   - Non-ASCII query → handles gracefully
   - All items score 0 → returns []
   - Very long query (1000+ chars) → truncates, no hang
   - Catalog with 1 item → returns it if score > 0
   - `--format json` output is valid JSON

4. **bundle.mjs --hosted** — slim output for CDN deployment. `dist/skill-browser-hosted.html` fetches `data.json` from a configured CDN URL rather than inlining it. Reduces bundle from 5.8MB to ~50KB.

### Gate 4:
- 6 templates visible in assembler Step 1
- Settings modal opens in index.html
- `node --test tests/*.test.mjs` → 110+ tests, 0 fail
- playground E2E smoke tests green (or marked skip with known issue logged)

---

## DAY 5 — Deploy to buildr.nu + Launch

### Vercel deployment

```json
// vercel.json
{
  "rewrites": [
    { "source": "/",           "destination": "/landing.html" },
    { "source": "/browse",     "destination": "/skill-browser.html" },
    { "source": "/assemble",   "destination": "/assembler.html" },
    { "source": "/playground", "destination": "/playground.html" }
  ],
  "buildCommand": "node bundle.mjs --sanitize",
  "outputDirectory": "dist",
  "framework": null
}
```

DNS: buildr.nu → Vercel. Student Developer Pack grants free Vercel Pro.
Setup: `vercel link` → `vercel deploy --prod` → DNS propagation (15-60 min).

### Brand sweep
- `index.html` `<title>`: "Skill Browser" → "buildr.nu — Skill Browser"
- All pages: add `<link rel="canonical" href="https://buildr.nu/...">` 
- OG images: one per page (generate with simple `og-image.html` → puppeteer screenshot)
- `landing.html`: add MCP install section, update CTA to `https://buildr.nu`

### MCP install documentation (landing + README)

New section in `landing.html`: **"Use inside Claude Code"**
```markdown
Add to ~/.claude/mcp.json to get search_skills and assemble_package
directly in any Claude Code session — no browser needed.
```

### Launch checklist
- [ ] `node build.mjs --sanitize` → zero absolute paths in output
- [ ] `node --test tests/*.test.mjs` → 110+ green
- [ ] `vercel deploy --prod` → smoke test `/`, `/browse`, `/assemble`, `/playground`
- [ ] MCP server tested with Claude Desktop locally (`search_skills` + `assemble_package`)
- [ ] CHANGELOG updated → v0.7.0
- [ ] GitHub release with ZIP artifact
- [ ] DNS verified: `buildr.nu` resolves to Vercel
- [ ] OG previews correct (test with opengraph.xyz)

---

## Business Model (clarity before launch)

buildr.nu sells **curation, templates, and team features** — not LLM access.

| Tier | Price | What |
|---|---|---|
| **Free** | $0 | Full browser + assembler + Groq/OpenRouter with **own key** + MCP server |
| **Pro** | $29/mo | Saved packages (GitHub Gist sync), package history, priority support |
| **Team** | $89/mo (5 seats) | Shared workspace, custom skill catalog, team templates |
| **Enterprise** | Deal | On-premise, SLA, compliance export, private skill catalog |

**Why this model works:** The LLM API costs are the *user's* variable cost. buildr.nu's value is fixed-cost infrastructure: 744-item curated catalog, package templates that work on day one, team collaboration. This is a better model than competing on API margins.

**Revenue projection (conservative):**
- 100 Pro users × $29 = $2,900/mo
- 20 Team accounts × $89 = $1,780/mo
- Total at modest scale: ~$4,680/mo (~56k SEK/mo)
- To justify at 100k/mo: ~345 Pro users or ~110 Team accounts

---

## Innovation Bets (ranked by impact vs effort)

| Bet | Impact | Effort | When |
|---|---|---|---|
| Build-time semantic embeddings | High — dramatically better offline ranking | Medium — 1 day | Day 2 |
| MCP server as distribution | Very High — lives inside Claude, viral | Medium — 1 day | Day 3 |
| Progressive enhancement tiers | High — visible quality signal, trust builder | Low — UI only | Day 1 |
| KICKOFF.md as open standard | High long-term — community, interoperability | Low — docs only | Ongoing |
| Package versioning (lock file) | Medium — enterprise need | Low — add to ZIP | Day 4 |
| WebLLM in-browser inference | Very High long-term — zero API keys | Very High | Future sprint |

---

## Orchestration Map

```
MASTER PIPELINE: week-v0.7
    │
    ├── STAGE 1 (Day 1): Foundation
    │   ├── WORKER A: build-sanitize
    │   ├── WORKER B: llm-client-module
    │   ├── WORKER C: assembler-settings-ui + progressive-enhancement
    │   └── REFLECTION: security-critic (key handling, no leakage)
    │
    ├── STAGE 2 (Day 2): Semantic
    │   ├── WORKER A: embeddings-builder (build.mjs --embeddings)
    │   ├── WORKER B: browser-semantic-search (Transformers.js + cosine)
    │   └── REFLECTION: quality-critic (semantic vs IDF on 4 benchmark queries)
    │
    ├── STAGE 3 (Day 3): MCP + Distribution
    │   ├── WORKER A: mcp-server (5 tools)
    │   ├── WORKER B: cli-entry (cli.mjs + launch-node.mjs)
    │   └── MAP-REDUCE: mcp-integration-tests (each tool tested in parallel)
    │
    ├── STAGE 4 (Day 4): Templates + Debt
    │   ├── WORKER A: template-library (6 templates + assembler UI)
    │   ├── WORKER B: settings-panel-fix (index.html ⚙)
    │   ├── WORKER C: playground-e2e (5 smoke tests)
    │   └── CIRCUIT-BREAKER: remaining-debt (skip if blocked, log for next sprint)
    │
    └── STAGE 5 (Day 5): Deploy
        ├── WORKER A: vercel-config (vercel.json + sanitized build)
        ├── WORKER B: brand-sweep (titles, OG, canonical URLs)
        ├── WORKER C: mcp-install-docs (README + landing section)
        └── REFLECTION: launch-critic (PUBLISH_CHECKLIST.md full run)
```

---

## Files to create / modify this week

**New files:**
| File | Day | Purpose |
|---|---|---|
| `llm-client.mjs` | 1 | Provider-agnostic LLM wrapper |
| `mcp-server.mjs` | 3 | MCP server with 5 tools |
| `cli.mjs` | 3 | Unified CLI entry point |
| `launch-node.mjs` | 3 | Cross-platform browser opener (replaces launch.sh) |
| `vercel.json` | 5 | Vercel deployment config |
| `tests/llm-client.test.mjs` | 1 | 15+ tests |
| `tests/mcp-server.test.mjs` | 3 | 12+ tests |
| `tests/e2e/playground.spec.js` | 4 | 5 smoke tests |

**Modified files:**
| File | Day | Change |
|---|---|---|
| `build.mjs` | 1 | `--sanitize` and `--embeddings` flags |
| `bundle.mjs` | 4 | `--hosted` flag (CDN-split output) |
| `assembler.html` | 1+2 | Settings modal, progressive enhancement tiers, template cards |
| `index.html` | 4 | Settings modal wired to ⚙ button, title updated |
| `recipes.json` | 4 | 6 package templates with `packageTemplate: true` |
| `landing.html` | 5 | MCP install section, buildr.nu canonical |
| `README.md` | 5 | MCP install instructions, live URL badges |
| `package.json` | 5 | bin entry for cli.mjs, version 0.7.0 |
| `CHANGELOG.md` | 5 | v0.7.0 entry |
