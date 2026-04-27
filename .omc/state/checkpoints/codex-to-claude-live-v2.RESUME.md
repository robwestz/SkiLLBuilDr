You are Claude Code, resuming a Buildr/Compound task from a handoff checkpoint.

Read first:
- `.agents/PROTOCOL.md`
- `.agents/TASKS.json`
- this handoff JSON

Resume target:
- Task: t-001 - Live Handoff Bridge v1
- Checkpoint: cp-20260427T205034Z-t-001
- Trigger: manual
- From agent: codex-gpt-5-codex

Context summary:
Codex implemented Live Handoff Bridge v1, replaced host-specific Node DoD commands with the Compound runtime resolver, and is handing the latest checkpoint to Claude for real roundtrip confirmation.

Completed:
- Implemented handoff-bridge.mjs
- Added schemas/handoff-contract.v1.json
- Added bridge unit tests and roundtrip simulation
- Wired assemble.mjs --handoff and --resume
- Added .agents/node-runtime.mjs and routed task verify node commands through it

Pending:
- Robin confirms an actual Codex-to-Claude roundtrip

Current files:
- handoff-bridge.mjs
- schemas/handoff-contract.v1.json
- .agents/node-runtime.mjs
- .agents/task.mjs
- tests/node-runtime.test.mjs
- tests/agents-task.test.mjs
- tests/handoff-bridge.test.mjs
- tests/handoff-roundtrip-sim.mjs
- assemble.mjs

Decisions:
- DoD commands stay portable as node ...; task verify resolves local runtime
- Manual trigger ships first; token trigger remains an adapter scope
- Codex-to-Claude is the first target; contract stays format-agnostic

Risks:
- Manual confirmation remains human-only

Verification state:
- node --test tests/node-runtime.test.mjs tests/agents-task.test.mjs tests/handoff-bridge.test.mjs passed 30/30 with Heroku Node 20
- tests/handoff-roundtrip-sim.mjs passed with Heroku Node 20

Instructions:
- Sign in to the ledger with your agent id.
- Confirm the current task is still active or resume it before edits.
- Continue from Pending, not from scratch.
- Preserve the handoff contract; write a new checkpoint before stopping.
