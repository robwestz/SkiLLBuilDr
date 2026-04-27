// tests/token-budget-trigger-sim.mjs — t-002 integration sim
// Simulates a long agent session with growing context, expects trigger near 85%.
// Run: node tests/token-budget-trigger-sim.mjs

import { makeBudgetTracker, suggestCheckpointCommand, CONSTANTS } from "../lib/token-budget.mjs";

const BUDGET = 200_000;
const THRESHOLD = CONSTANTS.DEFAULT_THRESHOLD;

let triggerEvent = null;

const tracker = makeBudgetTracker({
  budget: BUDGET,
  threshold: THRESHOLD,
  onTrigger: (state) => {
    triggerEvent = state;
    process.stdout.write(
      `[TRIGGER] ${state.used}/${state.budget} = ${(state.pct * 100).toFixed(2)}% ` +
        `(remaining: ${state.remaining})\n`
    );
    process.stdout.write("--- suggested checkpoint command ---\n");
    process.stdout.write(suggestCheckpointCommand(state, { taskId: "t-002", target: "claude" }) + "\n");
    process.stdout.write("--- end suggestion ---\n");
  },
});

const TURNS = 30;
const CHARS_PER_TURN = 25_000;
let lastTurn = 0;

for (let i = 1; i <= TURNS; i++) {
  lastTurn = i;
  const message = `Turn ${i}: ` + "x".repeat(CHARS_PER_TURN - 10);
  const state = tracker.add(message);
  if (state.triggered) break;
}

if (!triggerEvent) {
  console.error(`FAIL: tracker did not fire after ${lastTurn} simulated turns`);
  console.error(`Final state: ${JSON.stringify(tracker.state(), null, 2)}`);
  process.exit(1);
}

const expectedTriggerTokens = BUDGET * THRESHOLD;
const variance = Math.abs(triggerEvent.used - expectedTriggerTokens) / expectedTriggerTokens;

console.log(
  `Triggered after ${lastTurn} turns at ${triggerEvent.used}/${BUDGET} tokens ` +
    `(${(triggerEvent.pct * 100).toFixed(2)}%)`
);
console.log(`Expected first crossing near ${expectedTriggerTokens} tokens.`);
console.log(`Variance from ideal trigger point: ${(variance * 100).toFixed(2)}%`);

const MAX_VARIANCE = 0.05;
if (variance > MAX_VARIANCE) {
  console.error(`FAIL: variance ${(variance * 100).toFixed(2)}% > ${MAX_VARIANCE * 100}% allowed`);
  process.exit(2);
}

tracker.reset();
const resetState = tracker.state();
if (resetState.used !== 0 || resetState.triggered !== false) {
  console.error("FAIL: reset did not zero state");
  process.exit(3);
}

console.log("token-budget-trigger-sim: passed");
