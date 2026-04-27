You are Claude Code, resuming a Buildr/Compound task from a handoff checkpoint.

Read first:
- `.agents/PROTOCOL.md`
- `.agents/TASKS.json`
- this handoff JSON

Resume target:
- Task: t-001 - Live Handoff Bridge v1
- Checkpoint: cp-20260427T200834Z-t-001
- Trigger: manual
- From agent: codex-gpt-5-codex

Context summary:
Codex implemented Live Handoff Bridge v1 and is handing the current checkpoint to Claude for real roundtrip confirmation.

Completed:
- Implemented handoff-bridge.mjs
- Added schemas/handoff-contract.v1.json
- Added bridge unit tests and roundtrip simulation
- Wired assemble.mjs --handoff and --resume

Pending:
- Robin confirms an actual Codex-to-Claude roundtrip

Current files:
- handoff-bridge.mjs
- schemas/handoff-contract.v1.json
- tests/handoff-bridge.test.mjs
- tests/handoff-roundtrip-sim.mjs
- assemble.mjs

Decisions:
- Manual trigger ships first; token trigger remains an adapter scope
- Codex-to-Claude is the first target; contract stays format-agnostic

Risks:
- Manual confirmation remains human-only

Verification state:
- node --test tests/handoff-bridge.test.mjs passed 5/5 with Heroku Node 20
- tests/handoff-roundtrip-sim.mjs passed with Heroku Node 20

Instructions:
- Sign in to the ledger with your agent id.
- Confirm the current task is still active or resume it before edits.
- Continue from Pending, not from scratch.
- Preserve the handoff contract; write a new checkpoint before stopping.
