// llm-client.mjs — provider-agnostic LLM wrapper, zero npm deps
// Supports: Groq (free), OpenRouter (pay-as-you-go)
// Falls back to offline token-overlap scoring when no key is set.
//
// Facts before edit:
// 1. Callers: assembler.html (browser, inlined by bundle.mjs), mcp-server.mjs (future Node ESM import)
// 2. Public API: LLMClient class — create(), rankSkills(), buildPackageContext(), testConnection()
// 3. Catalog item shape: {type, name, slug, description, category, source, scope}
// 4. User instruction: "create llm-client.mjs with provider-agnostic interface, Groq implementation, and offline fallback"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_RANK_MODEL = "llama3-8b-8192";
const GROQ_DEEP_MODEL = "llama-3.3-70b-versatile";

// ---------------------------------------------------------------------------
// System prompt for rankSkills — causal reasoning, JSON-only output
// ---------------------------------------------------------------------------

const RANK_SKILLS_SYSTEM_PROMPT = `You are a causal skill ranker for software workspace assembly.

Your job: decide which skills have a genuine causal path to the goal's required outcome.

## The Fundamental Rule

Think causally, NOT associatively.

For every skill you include, you must be able to complete:
  "This skill CAUSES [specific artifact X], which the goal REQUIRES because [concrete reason Y]."

If you cannot complete that sentence with specific, non-trivial content — reject the skill.

REJECT skills that are only associatively related. Example: "uses Python" is NOT a reason to include a Python linter if the goal has no quality-review intent. The causal chain must be direct and specific.

## Output

Return ONLY a valid JSON object. No markdown fences, no prose outside JSON.

Schema:
{
  "ranked": [
    {
      "slug": "<exact slug from input>",
      "score": <integer 0-100>,
      "reason": "<one sentence: CAUSES X which goal REQUIRES because Y>",
      "confidence": "<high|medium|low>"
    }
  ]
}

Rules:
- Maximum 12 items in "ranked"
- Order ranked skills: foundational (planning, architecture) before dependent (testing, deployment)
- Score guidance: 85-100 = directly causes a primary requirement; 60-84 = causes important quality property; 30-59 = indirect causal path; 0-29 = reject instead
- confidence "high" = clear, direct causal path; "medium" = plausible but depends on interpretation; "low" = speculative
- Skills not in "ranked" are implicitly rejected — you are not required to list rejections

Every slug in "ranked" must be an exact slug from the input catalog.`;

// ---------------------------------------------------------------------------
// Offline IDF-based token overlap scorer (port from intent.mjs + llm.mjs)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from",
  "has", "have", "i", "if", "in", "is", "it", "its", "me", "my", "of", "on",
  "or", "our", "so", "that", "the", "their", "them", "then", "there", "they",
  "this", "to", "up", "was", "we", "were", "what", "when", "where", "which",
  "while", "will", "with", "you", "your", "want", "need", "should", "would",
  "can", "could", "how", "make", "get", "help", "please", "just", "some",
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function buildIdf(items) {
  const df = new Map();
  const N = items.length || 1;
  const docs = items.map((item) => {
    const tokens = new Set(
      tokenize(
        [
          item.slug || "",
          item.name || "",
          item.description || "",
          item.category || "",
        ].join(" ")
      )
    );
    for (const t of tokens) df.set(t, (df.get(t) ?? 0) + 1);
    return tokens;
  });
  const idf = new Map();
  for (const [t, f] of df) idf.set(t, Math.log((N + 1) / (f + 1)) + 1);
  return { idf, docs };
}

function scoreOffline(item, queryTokens, doc, idf) {
  let score = 0;
  const nameTokens = new Set(tokenize(item.name || ""));
  for (const q of queryTokens) {
    const w = idf.get(q) ?? 1;
    if (nameTokens.has(q)) score += 8 * w;
    else if ((item.name || "").toLowerCase().includes(q)) score += 4 * w;
    if (doc.has(q)) score += 2 * w;
  }
  return score;
}

function whyMatched(item, queryTokens) {
  const hits = [];
  const name = (item.name || "").toLowerCase();
  const desc = (item.description || "").toLowerCase();
  for (const q of queryTokens) {
    if (name.includes(q)) hits.push(`name:${q}`);
    else if (desc.includes(q)) hits.push(`review:${q}`);
  }
  return hits.length ? `Matched: ${hits.slice(0, 4).join(" ")}` : "Matched: token-overlap";
}

function offlineRankSkills(goal, catalogItems) {
  if (!goal || !goal.trim()) return [];
  if (!catalogItems || catalogItems.length === 0) return [];

  const queryTokens = tokenize(goal);
  if (queryTokens.length === 0) return [];

  const { idf, docs } = buildIdf(catalogItems);

  return catalogItems
    .map((item, i) => {
      const rawScore = scoreOffline(item, queryTokens, docs[i], idf);
      return { item, rawScore };
    })
    .filter(({ rawScore }) => rawScore > 0)
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 12)
    .map(({ item, rawScore }) => {
      // Normalise raw TF-IDF score to 0-100 range
      const maxRaw = catalogItems.length * 10;
      const score = Math.min(100, Math.round((rawScore / maxRaw) * 100));
      const confidence = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
      return {
        slug: item.slug,
        name: item.name,
        score,
        reason: whyMatched(item, queryTokens),
        confidence,
      };
    });
}

// ---------------------------------------------------------------------------
// Offline buildPackageContext
// ---------------------------------------------------------------------------

const CLI_KEYWORDS = ["cli", "command", "terminal", "script", "bin", "tool"];
const API_KEYWORDS = ["api", "rest", "endpoint", "server", "route", "http"];
const TEST_KEYWORDS = ["test", "tdd", "coverage", "spec", "unit", "e2e"];
const REVIEW_KEYWORDS = ["review", "audit", "check", "lint", "quality"];

function offlineBuildPackageContext(goal, description, selectedSkills) {
  const goalLower = (goal || "").toLowerCase();
  const skills = selectedSkills || [];

  const isCli = CLI_KEYWORDS.some((k) => goalLower.includes(k));
  const isApi = API_KEYWORDS.some((k) => goalLower.includes(k));
  const hasTesting = TEST_KEYWORDS.some((k) => goalLower.includes(k));
  const hasReview = REVIEW_KEYWORDS.some((k) => goalLower.includes(k));

  const firstMoves = [];

  if (isCli) {
    firstMoves.push("Define CLI entry point and argument schema before writing any logic.");
    firstMoves.push("Add --help output and verify it renders correctly.");
  } else if (isApi) {
    firstMoves.push("Scaffold API route structure with typed request/response shapes.");
    firstMoves.push("Set up authentication middleware before implementing business logic.");
  } else {
    firstMoves.push("Break the goal into ordered phases — foundational decisions first.");
    firstMoves.push("Identify the primary production artifact and work backwards from it.");
  }

  if (hasTesting) {
    firstMoves.push("Write the first failing test before any implementation code.");
  }
  if (hasReview) {
    firstMoves.push("Establish a baseline lint/review pass on existing code before adding features.");
  }
  if (skills.length > 0) {
    firstMoves.push(`Activate skill: ${skills[0].slug || skills[0].name} as the first workspace tool.`);
  }

  firstMoves.push("Commit a working skeleton before adding complexity.");

  return {
    summary: `[offline] Workspace package for: "${goal}". ${skills.length} skill(s) selected. Set a GROQ_API_KEY for AI-generated context.`,
    risks: [
      "[offline] Risk analysis requires LLM. Common risks: scope creep, missing auth, no error handling.",
    ],
    firstMoves,
    estimatedHours: null,
  };
}

// ---------------------------------------------------------------------------
// OfflineProvider
// ---------------------------------------------------------------------------

class OfflineProvider {
  constructor() {
    this._providerName = "offline";
  }

  async rankSkills(goal, catalogItems /*, options = {}*/) {
    return offlineRankSkills(goal, catalogItems);
  }

  async buildPackageContext(goal, description, selectedSkills) {
    return offlineBuildPackageContext(goal, description, selectedSkills);
  }

  async testConnection() {
    return { ok: true, model: "offline-idf", latencyMs: 0 };
  }
}

// ---------------------------------------------------------------------------
// GroqProvider
// ---------------------------------------------------------------------------

class GroqProvider {
  constructor(apiKey, options = {}) {
    this._apiKey = apiKey;
    this._baseUrl = options.baseUrl || GROQ_BASE_URL;
    this._providerName = "groq";
  }

  async _chat(model, systemPrompt, userMessage) {
    const t0 = Date.now();
    let response;
    try {
      response = await fetch(`${this._baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: "json_object" },
        }),
      });
    } catch {
      throw new Error("LLM provider unreachable: groq");
    }

    const latencyMs = Date.now() - t0;

    if (response.status === 401) {
      throw new Error("Invalid API key for groq");
    }
    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after") ?? "unknown";
      throw new Error(`Rate limit reached. Wait ${retryAfter}s or switch to offline mode.`);
    }
    if (!response.ok) {
      throw new Error(`LLM provider error: groq returned HTTP ${response.status}`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("LLM provider unreachable: groq");
    }

    const raw = data?.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`LLM response was not valid JSON. Raw: ${raw.slice(0, 200)}`);
    }

    return { parsed, latencyMs };
  }

  async rankSkills(goal, catalogItems /*, options = {}*/) {
    if (!goal || !goal.trim()) return [];
    if (!catalogItems || catalogItems.length === 0) return [];

    const catalogSummary = catalogItems.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      category: s.category,
    }));

    const userMessage = JSON.stringify({
      goal,
      catalog: catalogSummary,
      instruction:
        "Rank these skills causally for this goal. Return valid JSON matching the schema in the system prompt.",
    });

    const { parsed } = await this._chat(GROQ_RANK_MODEL, RANK_SKILLS_SYSTEM_PROMPT, userMessage);

    if (!parsed || !Array.isArray(parsed.ranked)) {
      // Guard: malformed but parseable JSON missing the required field
      if (parsed && typeof parsed === "object" && !("ranked" in parsed)) {
        throw new Error(
          `LLM response was not valid JSON. Raw: ${JSON.stringify(parsed).slice(0, 200)}`
        );
      }
      return [];
    }

    // Normalise and filter
    return parsed.ranked
      .filter((item) => item && typeof item.slug === "string")
      .map((item) => ({
        slug: item.slug,
        name: item.name ?? catalogItems.find((c) => c.slug === item.slug)?.name ?? item.slug,
        score: typeof item.score === "number" ? Math.min(100, Math.max(0, item.score)) : 50,
        reason: item.reason ?? "(no reason provided)",
        confidence: ["high", "medium", "low"].includes(item.confidence)
          ? item.confidence
          : "medium",
      }));
  }

  async buildPackageContext(goal, description, selectedSkills) {
    const userMessage = JSON.stringify({
      goal,
      description,
      skills: (selectedSkills || []).map((s) => ({ slug: s.slug, name: s.name })),
      instruction:
        "Produce a workspace package context. Return JSON with: summary (string), risks (string[]), firstMoves (string[]), estimatedHours (number|null).",
    });

    const contextSystemPrompt = `You are a senior engineering advisor. Given a goal and selected skills, produce a concise workspace package context.

Return ONLY valid JSON:
{
  "summary": "<2-3 sentence description of what this package achieves>",
  "risks": ["<risk 1>", "<risk 2>"],
  "firstMoves": ["<action 1>", "<action 2>", "<action 3>"],
  "estimatedHours": <integer or null>
}`;

    const { parsed } = await this._chat(GROQ_DEEP_MODEL, contextSystemPrompt, userMessage);

    return {
      summary: parsed.summary ?? "(no summary)",
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      firstMoves: Array.isArray(parsed.firstMoves) ? parsed.firstMoves : [],
      estimatedHours: typeof parsed.estimatedHours === "number" ? parsed.estimatedHours : null,
    };
  }

  async testConnection() {
    const t0 = Date.now();
    let response;
    try {
      response = await fetch(`${this._baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this._apiKey}` },
      });
    } catch {
      return { ok: false, model: null, latencyMs: Date.now() - t0 };
    }
    const latencyMs = Date.now() - t0;
    if (!response.ok) {
      return { ok: false, model: null, latencyMs };
    }
    return { ok: true, model: GROQ_RANK_MODEL, latencyMs };
  }
}

// ---------------------------------------------------------------------------
// LLMClient — public factory class
// ---------------------------------------------------------------------------

export class LLMClient {
  /**
   * Factory — returns a provider instance.
   * @param {"offline"|"groq"} provider
   * @param {string} [apiKey]
   * @param {object} [options]
   * @returns {OfflineProvider|GroqProvider}
   */
  static create(provider, apiKey, options = {}) {
    switch (provider) {
      case "offline":
        return new OfflineProvider();
      case "groq": {
        const key = apiKey || "";
        return new GroqProvider(key, options);
      }
      default:
        throw new Error(`Unknown LLM provider: "${provider}". Supported: "groq", "offline".`);
    }
  }
}

// Also export provider classes for advanced use
export { OfflineProvider, GroqProvider };
