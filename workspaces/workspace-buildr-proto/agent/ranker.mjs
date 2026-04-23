/**
 * agent/ranker.mjs
 *
 * Skill ranker that produces causal justifications, not just scores.
 *
 * Two paths:
 *   - LLM path (Groq): sends goal + catalog to the model with the system
 *     prompt from prompts/rank-skills.md, gets back structured JSON with
 *     causal chains per skill.
 *   - Offline path: delegates to llmClient.rankOffline() which uses
 *     token-overlap scoring and produces the same output shape.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { DEFAULT_CATALOG } from './bdi.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, '..', 'prompts');

// ---------------------------------------------------------------------------
// Prompt loader
// ---------------------------------------------------------------------------

/**
 * Load the rank-skills system prompt from disk.
 * Falls back to a compact inline version if the file is missing.
 *
 * @returns {Promise<string>}
 */
async function loadRankSkillsPrompt() {
  try {
    const promptPath = join(PROMPTS_DIR, 'rank-skills.md');
    return await readFile(promptPath, 'utf-8');
  } catch {
    // Inline fallback — ranker works even if prompts/ is absent
    return `You are a causal skill ranker for software workspace assembly.

Given a goal and a list of skills, determine which skills have a causal path to the goal's required outcome.

IMPORTANT: Think causally, not associatively.
- Wrong: "TDD seems relevant for APIs"
- Correct: "TDD causes test coverage to exist before implementation, which is required because production APIs must be verifiable"

For each skill, complete the sentence: "This skill CAUSES [X] which the goal REQUIRES because [Y]."
If you cannot complete that sentence with specific content, reject the skill with a reason.

Return JSON exactly: { "ranked": [{"slug":"...","causalChain":"...","role":"core|supporting|optional","score":0-100}], "rejected": [{"slug":"...","reason":"..."}] }

Order ranked skills: foundational skills (planning, architecture) before dependent skills (testing, deployment).
Define "production-grade" specifically for the goal type — an API has different production requirements than a CLI.`;
  }
}

// ---------------------------------------------------------------------------
// LLM ranking path helpers
// ---------------------------------------------------------------------------

/**
 * Build the user message for the LLM ranking call.
 *
 * @param {string} goal
 * @param {object[]} catalog
 * @returns {string}
 */
function buildRankingMessage(goal, catalog) {
  const catalogSummary = catalog.map(s => ({
    slug: s.slug,
    name: s.name,
    tags: s.tags,
    domains: s.domains,
    description: s.description,
  }));

  return JSON.stringify({
    goal,
    catalog: catalogSummary,
    instruction: 'Rank these skills causally for this goal. Return valid JSON matching the schema in the system prompt.',
  }, null, 2);
}

/**
 * Validate and normalise the LLM response into the required return shape.
 * Handles partial responses and missing fields without throwing.
 *
 * @param {object} raw - Parsed JSON from LLM
 * @param {object[]} catalog - Full catalog (used to fill missing name fields)
 * @param {string} model - Model name for the modelUsed field
 * @returns {{ ranked: object[], rejected: object[], modelUsed: string, offline: false }}
 */
function normaliseRankingResponse(raw, catalog, model) {
  const catalogBySlug = Object.fromEntries(catalog.map(s => [s.slug, s]));

  const ranked = (Array.isArray(raw.ranked) ? raw.ranked : []).map(item => ({
    slug: item.slug || '(unknown)',
    name: item.name || catalogBySlug[item.slug]?.name || item.slug,
    score: typeof item.score === 'number' ? Math.min(100, Math.max(0, item.score)) : 50,
    causalChain: item.causalChain || item.causal_chain || item.justification || '(no causal chain provided by model)',
    role: ['core', 'supporting', 'optional'].includes(item.role) ? item.role : 'supporting',
  }));

  const rejected = (Array.isArray(raw.rejected) ? raw.rejected : []).map(item => ({
    slug: item.slug || '(unknown)',
    name: item.name || catalogBySlug[item.slug]?.name || item.slug,
    reason: item.reason || '(no reason provided by model)',
  }));

  // Any catalog skill the LLM omitted entirely is treated as implicitly rejected
  const mentionedSlugs = new Set([...ranked.map(r => r.slug), ...rejected.map(r => r.slug)]);
  for (const skill of catalog) {
    if (!mentionedSlugs.has(skill.slug)) {
      rejected.push({
        slug: skill.slug,
        name: skill.name,
        reason: '(skill not addressed in LLM response — treated as implicitly rejected)',
      });
    }
  }

  return { ranked, rejected, modelUsed: model, offline: false };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Rank skills for a goal, producing causal justifications for each decision.
 *
 * Uses the LLM when the client is online, falls back to token-overlap
 * ranking when offline or when the LLM call fails.
 *
 * @param {string} goal - Natural language goal string
 * @param {object[]} [catalog] - Skill catalog entries (defaults to DEFAULT_CATALOG)
 * @param {object} llmClient - Client from createClient() in agent/llm.mjs
 * @returns {Promise<{
 *   ranked: Array<{ slug: string, name: string, score: number, causalChain: string, role: string }>,
 *   rejected: Array<{ slug: string, name: string, reason: string }>,
 *   modelUsed: string,
 *   offline: boolean
 * }>}
 */
export async function rankSkills(goal, catalog = DEFAULT_CATALOG, llmClient) {
  if (!llmClient) {
    throw new Error(
      'rankSkills requires an llmClient. Create one with createClient() from agent/llm.mjs.',
    );
  }

  // Offline path — skip LLM, use token-overlap directly
  if (llmClient.provider === 'offline') {
    const result = llmClient.rankOffline(goal, catalog);
    return {
      ranked: result.ranked,
      rejected: result.rejected,
      modelUsed: 'offline-token-overlap',
      offline: true,
    };
  }

  // LLM path
  const systemPrompt = await loadRankSkillsPrompt();
  const userMessage = buildRankingMessage(goal, catalog);

  let raw;
  try {
    raw = await llmClient.complete(systemPrompt, userMessage, { json: true, temperature: 0.1 });
  } catch (err) {
    // LLM call failed — degrade gracefully to offline ranker
    console.error(`[ranker] LLM call failed (${err.message}). Falling back to offline ranker.`);
    const result = llmClient.rankOffline(goal, catalog);
    return {
      ranked: result.ranked,
      rejected: result.rejected,
      modelUsed: `offline-token-overlap (fallback after LLM error: ${err.message.slice(0, 80)})`,
      offline: true,
    };
  }

  // Guard: LLM returned offline placeholder (should not happen, but be defensive)
  if (raw && raw.offline === true) {
    const result = llmClient.rankOffline(goal, catalog);
    return {
      ranked: result.ranked,
      rejected: result.rejected,
      modelUsed: 'offline-token-overlap',
      offline: true,
    };
  }

  return normaliseRankingResponse(raw, catalog, llmClient.model);
}
