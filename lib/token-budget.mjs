// lib/token-budget.mjs — Compound Protocol t-002
// Heuristic token-budget detector + handoff-bridge adapter.
// Pure logic, zero deps. Detection only — does NOT auto-fire handoffs.
// Per FUTURE_WORK.md #1: ship adapter pattern; runtime API integration is future work.

const DEFAULT_THRESHOLD = 0.85;       // trigger at 85% used
const CHARS_PER_TOKEN = 4;            // standard Claude/GPT-class heuristic (±15% accuracy)
const HEURISTIC_VARIANCE = 0.15;      // documented expected error band

export const CONSTANTS = Object.freeze({
  DEFAULT_THRESHOLD,
  CHARS_PER_TOKEN,
  HEURISTIC_VARIANCE,
});

/**
 * Estimate token count from a text string using chars/4 heuristic.
 * Non-strings return 0.
 */
export function estimateTokens(text) {
  if (typeof text !== "string") return 0;
  if (!text.length) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Fraction of budget consumed, clamped to [0, 1]. Zero/negative budget returns 0.
 */
export function pctConsumed({ used, budget }) {
  if (!budget || budget <= 0) return 0;
  if (!used || used <= 0) return 0;
  return Math.min(1, used / budget);
}

/**
 * Whether the current used/budget ratio meets or exceeds threshold.
 */
export function shouldTrigger({ used, budget, threshold = DEFAULT_THRESHOLD }) {
  return pctConsumed({ used, budget }) >= threshold;
}

/**
 * Stateful tracker that fires onTrigger exactly once when the threshold is
 * first crossed.
 *
 *   const t = makeBudgetTracker({ budget: 200_000, threshold: 0.85, onTrigger });
 *   t.add(message);            // estimates tokens, accumulates
 *   t.setUsed(rawTokenCount);  // override estimation when SDK count is available
 *   t.state();                 // { used, budget, threshold, pct, remaining, triggered }
 *   t.reset();                 // zero state, allow re-triggering
 */
export function makeBudgetTracker({ budget, threshold = DEFAULT_THRESHOLD, onTrigger } = {}) {
  if (!budget || budget <= 0) throw new Error("makeBudgetTracker requires budget > 0");
  if (threshold <= 0 || threshold > 1) throw new Error("threshold must be in (0, 1]");

  let used = 0;
  let triggered = false;

  const state = () => ({
    used,
    budget,
    threshold,
    pct: pctConsumed({ used, budget }),
    remaining: Math.max(0, budget - used),
    triggered,
  });

  const checkTrigger = () => {
    if (!triggered && shouldTrigger({ used, budget, threshold })) {
      triggered = true;
      if (typeof onTrigger === "function") onTrigger(state());
    }
  };

  return {
    add(input) {
      const tokens = typeof input === "string" ? estimateTokens(input) : Math.max(0, Number(input) || 0);
      used += tokens;
      checkTrigger();
      return state();
    },
    setUsed(n) {
      used = Math.max(0, Number(n) || 0);
      checkTrigger();
      return state();
    },
    state,
    reset() {
      used = 0;
      triggered = false;
    },
  };
}

/**
 * Produce a copy-pasteable handoff-bridge invocation that captures the current
 * state. Does NOT execute — the caller (or operator) decides when to run it.
 *
 * This is the v1 adapter contract: detection emits a suggestion; firing is manual.
 */
export function suggestCheckpointCommand(state, { taskId = "current", target = "claude", summary } = {}) {
  if (!state || typeof state.used !== "number" || typeof state.budget !== "number") {
    throw new Error("suggestCheckpointCommand requires state with numeric used + budget");
  }
  const pctStr = (state.pct * 100).toFixed(1);
  const summaryText = summary || `Token budget threshold ${pctStr}% reached on task ${taskId}`;
  return [
    `# Token budget threshold reached: ${state.used}/${state.budget} tokens = ${pctStr}%`,
    `# Suggested action: capture state via handoff-bridge before context fills.`,
    `node handoff-bridge.mjs checkpoint \\`,
    `  --trigger token \\`,
    `  --to ${target} \\`,
    `  --task ${taskId} \\`,
    `  --summary ${JSON.stringify(summaryText)}`,
  ].join("\n");
}

/**
 * Default budgets per known model. Override with explicit budget when wiring.
 */
export const MODEL_BUDGETS = Object.freeze({
  "claude-opus-4-7-1m": 1_000_000,
  "claude-opus-4-7": 200_000,
  "claude-sonnet-4-6": 200_000,
  "claude-haiku-4-5": 200_000,
  "gpt-5-codex": 256_000,
  "gpt-5.5": 200_000,
});

export function budgetForModel(modelId) {
  return MODEL_BUDGETS[modelId] || null;
}
