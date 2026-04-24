/**
 * agent/llm.mjs
 *
 * Provider-agnostic LLM client.
 * Primary provider: Groq (free, no card, console.groq.com).
 * Fallback: offline token-overlap ranker (zero setup, no API key needed).
 *
 * Uses native fetch (Node 18+). Zero external dependencies.
 */

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const FAST_MODEL = 'llama-3.1-8b-instant';

// ---------------------------------------------------------------------------
// Groq provider
// ---------------------------------------------------------------------------

/**
 * Make a chat completion request to Groq.
 *
 * @param {string} apiKey
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ json?: boolean, temperature?: number }} options
 * @returns {Promise<string>} Raw text content from the model
 */
async function groqComplete(apiKey, model, systemPrompt, userMessage, options = {}) {
  const { json = false, temperature = 0.2 } = options;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature,
    max_tokens: 4096,
  };

  if (json) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(GROQ_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '(no body)');
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('Groq returned empty choices array');
  }

  return data.choices[0].message.content;
}

/**
 * Check Groq API connectivity with a minimal probe request.
 *
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
async function checkGroqConnectivity(apiKey) {
  if (!apiKey) return false;
  try {
    const response = await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    // 401/403 = bad key; any other status means we reached Groq
    return response.status !== 401 && response.status !== 403;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Offline provider — token-overlap ranker
// ---------------------------------------------------------------------------

/**
 * Tokenize a string into lowercase alphanumeric tokens of length > 1.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Score a skill against goal tokens using weighted token overlap.
 * Longer tokens carry higher weight (more specific = stronger signal).
 *
 * @param {object} skill - Catalog skill entry
 * @param {Set<string>} goalTokens
 * @returns {number} Score 0–100
 */
function scoreSkillOffline(skill, goalTokens) {
  const skillText = [
    skill.slug.replace(/[:/]/g, ' '),
    skill.name || '',
    (skill.tags || []).join(' '),
    (skill.domains || []).join(' '),
    skill.description || '',
  ].join(' ');

  const skillTokens = new Set(tokenize(skillText));
  let score = 0;
  let maxPossible = 0;

  for (const token of goalTokens) {
    const weight = Math.max(1, token.length - 2);
    maxPossible += weight;
    if (skillTokens.has(token)) {
      score += weight;
    }
  }

  if (maxPossible === 0) return 0;
  return Math.min(100, Math.round((score / maxPossible) * 100));
}

/**
 * Assign a role label based on offline overlap score.
 *
 * @param {number} score
 * @returns {'core'|'supporting'|'optional'}
 */
function roleFromScore(score) {
  if (score >= 55) return 'core';
  if (score >= 25) return 'supporting';
  return 'optional';
}

/**
 * Offline skill ranking using token-overlap scoring.
 * Returns the same shape as the LLM ranking path.
 *
 * @param {string} goal
 * @param {object[]} catalog
 * @returns {{ ranked: object[], rejected: object[], offline: true }}
 */
function offlineRank(goal, catalog) {
  const goalTokens = new Set(tokenize(goal));
  const REJECTION_THRESHOLD = 8;

  const scored = catalog
    .map(skill => ({ skill, score: scoreSkillOffline(skill, goalTokens) }))
    .sort((a, b) => b.score - a.score);

  const ranked = [];
  const rejected = [];

  for (const { skill, score } of scored) {
    if (score > REJECTION_THRESHOLD) {
      ranked.push({
        slug: skill.slug,
        name: skill.name,
        score,
        causalChain: `[offline] Token overlap score ${score}/100. Skill tags [${(skill.tags || []).slice(0, 4).join(', ')}] matched goal tokens [${[...goalTokens].slice(0, 5).join(', ')}]. Full causal reasoning requires Groq — set GROQ_API_KEY for LLM analysis.`,
        role: roleFromScore(score),
      });
    } else {
      rejected.push({
        slug: skill.slug,
        name: skill.name,
        reason: `[offline] Token overlap score ${score}/100 — below threshold ${REJECTION_THRESHOLD}. Insufficient lexical connection between skill surface and goal text. Set GROQ_API_KEY for causal rejection reasoning.`,
      });
    }
  }

  return { ranked, rejected, offline: true };
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

/**
 * Create a provider-agnostic LLM client.
 *
 * Auto-detects offline mode when GROQ_API_KEY is not set or provider is
 * explicitly set to 'offline'.
 *
 * @param {{ provider?: 'groq'|'offline', apiKey?: string, model?: string }} options
 * @returns {{
 *   provider: string,
 *   model: string,
 *   complete: (systemPrompt: string, userMessage: string, opts?: object) => Promise<string|object>,
 *   isOnline: () => Promise<boolean>,
 *   rankOffline: (goal: string, catalog: object[]) => object
 * }}
 */
export function createClient(options = {}) {
  const {
    provider: requestedProvider = process.env.GROQ_API_KEY ? 'groq' : 'offline',
    apiKey = process.env.GROQ_API_KEY || '',
    model = DEFAULT_MODEL,
  } = options;

  // Silently downgrade to offline if groq was requested but no key is present
  const resolvedProvider = (requestedProvider === 'groq' && !apiKey) ? 'offline' : requestedProvider;

  let _onlineStatusCache = null;

  return {
    provider: resolvedProvider,
    model: resolvedProvider === 'groq' ? model : 'offline-token-overlap',

    /**
     * Complete a prompt using the configured provider.
     *
     * @param {string} systemPrompt
     * @param {string} userMessage
     * @param {{ json?: boolean, temperature?: number, fast?: boolean }} opts
     * @returns {Promise<string|object>}
     */
    async complete(systemPrompt, userMessage, opts = {}) {
      if (resolvedProvider === 'offline') {
        const payload = {
          offline: true,
          note: 'Offline mode active — token overlap ranking only. Set GROQ_API_KEY for LLM-based causal reasoning.',
          rawPromptPreview: userMessage.slice(0, 200),
        };
        return opts.json ? payload : JSON.stringify(payload, null, 2);
      }

      const activeModel = opts.fast ? FAST_MODEL : model;
      const rawContent = await groqComplete(apiKey, activeModel, systemPrompt, userMessage, opts);

      if (opts.json) {
        try {
          return JSON.parse(rawContent);
        } catch {
          // Attempt to extract JSON from a markdown code fence
          const match = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            try {
              return JSON.parse(match[1]);
            } catch {
              // fall through to error
            }
          }
          throw new Error(
            `LLM response could not be parsed as JSON.\nFirst 400 chars: ${rawContent.slice(0, 400)}`,
          );
        }
      }

      return rawContent;
    },

    /**
     * Check whether the configured LLM provider is reachable.
     * Result is cached after the first call to avoid redundant probes.
     *
     * @returns {Promise<boolean>}
     */
    async isOnline() {
      if (resolvedProvider === 'offline') return false;
      if (_onlineStatusCache !== null) return _onlineStatusCache;
      _onlineStatusCache = await checkGroqConnectivity(apiKey);
      return _onlineStatusCache;
    },

    /**
     * Rank skills offline without any LLM call.
     * Exposed so ranker.mjs can use it directly in offline mode.
     *
     * @param {string} goal
     * @param {object[]} catalog
     * @returns {{ ranked: object[], rejected: object[], offline: true }}
     */
    rankOffline(goal, catalog) {
      return offlineRank(goal, catalog);
    },
  };
}

// Export model name constants for downstream use
export { DEFAULT_MODEL, FAST_MODEL };
