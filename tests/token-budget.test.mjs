// Tests for lib/token-budget.mjs — Compound Protocol t-002
// Run: node --test tests/token-budget.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estimateTokens,
  pctConsumed,
  shouldTrigger,
  makeBudgetTracker,
  suggestCheckpointCommand,
  budgetForModel,
  CONSTANTS,
  MODEL_BUDGETS,
} from "../lib/token-budget.mjs";

test("estimateTokens: chars/4 heuristic, edge cases", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("test"), 1);
  assert.equal(estimateTokens("a".repeat(40)), 10);
  assert.equal(estimateTokens("a".repeat(41)), 11);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
  assert.equal(estimateTokens(42), 0);
});

test("pctConsumed: clamped to [0, 1] and handles zero/negative budget", () => {
  assert.equal(pctConsumed({ used: 0, budget: 100 }), 0);
  assert.equal(pctConsumed({ used: 50, budget: 100 }), 0.5);
  assert.equal(pctConsumed({ used: 100, budget: 100 }), 1);
  assert.equal(pctConsumed({ used: 200, budget: 100 }), 1);
  assert.equal(pctConsumed({ used: 50, budget: 0 }), 0);
  assert.equal(pctConsumed({ used: 50, budget: -1 }), 0);
  assert.equal(pctConsumed({ used: -10, budget: 100 }), 0);
});

test("shouldTrigger: fires at default 85% threshold", () => {
  assert.equal(shouldTrigger({ used: 84, budget: 100 }), false);
  assert.equal(shouldTrigger({ used: 85, budget: 100 }), true);
  assert.equal(shouldTrigger({ used: 90, budget: 100 }), true);
});

test("shouldTrigger: respects custom threshold", () => {
  assert.equal(shouldTrigger({ used: 50, budget: 100, threshold: 0.5 }), true);
  assert.equal(shouldTrigger({ used: 49, budget: 100, threshold: 0.5 }), false);
  assert.equal(shouldTrigger({ used: 99, budget: 100, threshold: 0.99 }), true);
  assert.equal(shouldTrigger({ used: 100, budget: 100, threshold: 1 }), true);
});

test("makeBudgetTracker: requires positive budget", () => {
  assert.throws(() => makeBudgetTracker({}), /budget > 0/);
  assert.throws(() => makeBudgetTracker({ budget: 0 }), /budget > 0/);
  assert.throws(() => makeBudgetTracker({ budget: -1 }), /budget > 0/);
});

test("makeBudgetTracker: validates threshold range", () => {
  assert.throws(() => makeBudgetTracker({ budget: 100, threshold: 0 }), /threshold/);
  assert.throws(() => makeBudgetTracker({ budget: 100, threshold: -0.1 }), /threshold/);
  assert.throws(() => makeBudgetTracker({ budget: 100, threshold: 1.5 }), /threshold/);
});

test("makeBudgetTracker.add: accumulates token estimates", () => {
  const t = makeBudgetTracker({ budget: 100 });
  let s = t.state();
  assert.equal(s.used, 0);
  assert.equal(s.pct, 0);
  s = t.add("a".repeat(40));
  assert.equal(s.used, 10);
  assert.equal(s.pct, 0.1);
  s = t.add("a".repeat(80));
  assert.equal(s.used, 30);
  assert.equal(s.remaining, 70);
});

test("makeBudgetTracker.add: accepts numeric tokens directly", () => {
  const t = makeBudgetTracker({ budget: 100 });
  t.add(50);
  assert.equal(t.state().used, 50);
  t.add(20);
  assert.equal(t.state().used, 70);
});

test("makeBudgetTracker.onTrigger: fires exactly once when threshold crossed", () => {
  const seen = [];
  const t = makeBudgetTracker({
    budget: 100,
    threshold: 0.5,
    onTrigger: (s) => seen.push(s),
  });
  t.add("a".repeat(160));
  assert.equal(seen.length, 0);
  t.add("a".repeat(80));
  assert.equal(seen.length, 1);
  assert.ok(seen[0].triggered);
  assert.equal(seen[0].used, 60);
  t.add("a".repeat(80));
  assert.equal(seen.length, 1);
  t.add(1000);
  assert.equal(seen.length, 1);
});

test("makeBudgetTracker.setUsed: bypasses estimation, can fire trigger", () => {
  let triggered = false;
  const t = makeBudgetTracker({
    budget: 100,
    threshold: 0.85,
    onTrigger: () => {
      triggered = true;
    },
  });
  t.setUsed(50);
  assert.equal(t.state().used, 50);
  assert.equal(triggered, false);
  t.setUsed(86);
  assert.equal(triggered, true);
  assert.equal(t.state().triggered, true);
});

test("makeBudgetTracker.reset: zeroes state and allows re-triggering", () => {
  let calls = 0;
  const t = makeBudgetTracker({
    budget: 100,
    threshold: 0.5,
    onTrigger: () => calls++,
  });
  t.setUsed(80);
  assert.equal(calls, 1);
  t.reset();
  assert.equal(t.state().used, 0);
  assert.equal(t.state().triggered, false);
  t.setUsed(80);
  assert.equal(calls, 2);
});

test("makeBudgetTracker: exposes threshold + remaining in state", () => {
  const t = makeBudgetTracker({ budget: 1000, threshold: 0.7 });
  t.add(300);
  const s = t.state();
  assert.equal(s.threshold, 0.7);
  assert.equal(s.remaining, 700);
  assert.equal(s.used, 300);
  assert.equal(s.budget, 1000);
});

test("suggestCheckpointCommand: produces handoff-bridge invocation", () => {
  const state = {
    used: 170_000,
    budget: 200_000,
    pct: 0.85,
    threshold: 0.85,
    remaining: 30_000,
    triggered: true,
  };
  const cmd = suggestCheckpointCommand(state, { taskId: "t-002", target: "codex" });
  assert.match(cmd, /handoff-bridge\.mjs checkpoint/);
  assert.match(cmd, /--trigger token/);
  assert.match(cmd, /--to codex/);
  assert.match(cmd, /--task t-002/);
  assert.match(cmd, /85\.0%/);
  assert.match(cmd, /170000\/200000/);
});

test("suggestCheckpointCommand: validates state shape", () => {
  assert.throws(() => suggestCheckpointCommand(null), /state/);
  assert.throws(() => suggestCheckpointCommand({ used: "x", budget: 1 }), /numeric/);
});

test("suggestCheckpointCommand: accepts custom summary", () => {
  const state = { used: 85, budget: 100, pct: 0.85, threshold: 0.85, remaining: 15, triggered: true };
  const cmd = suggestCheckpointCommand(state, { taskId: "x", summary: "custom summary text" });
  assert.match(cmd, /custom summary text/);
});

test("CONSTANTS export sane defaults and is frozen", () => {
  assert.equal(CONSTANTS.DEFAULT_THRESHOLD, 0.85);
  assert.equal(CONSTANTS.CHARS_PER_TOKEN, 4);
  assert.equal(CONSTANTS.HEURISTIC_VARIANCE, 0.15);
  assert.throws(() => {
    "use strict";
    CONSTANTS.DEFAULT_THRESHOLD = 0.5;
  });
});

test("MODEL_BUDGETS: covers known models, frozen", () => {
  assert.equal(typeof MODEL_BUDGETS["claude-opus-4-7"], "number");
  assert.equal(typeof MODEL_BUDGETS["gpt-5-codex"], "number");
  assert.throws(() => {
    "use strict";
    MODEL_BUDGETS["claude-opus-4-7"] = 0;
  });
});

test("budgetForModel: returns budget or null", () => {
  assert.equal(typeof budgetForModel("claude-opus-4-7"), "number");
  assert.equal(budgetForModel("nonexistent-model"), null);
  assert.equal(budgetForModel(""), null);
  assert.equal(budgetForModel(undefined), null);
});
