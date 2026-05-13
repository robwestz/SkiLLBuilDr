# Agentic Factory v1 — Production DoD Progress

> **Compact-resilient state file.** If you're a fresh Claude session resuming
> this work, read this file + `git log --oneline -10` + `node .agents/task.mjs
> status`. Together they tell you exactly where work stands.

## Source plan

`docs/PHASE_PLAN_AGENTIC_FACTORY.md` — composer-issued phase plan for the
ECC Browser → MCP/CLI → Agentic OS factory.

## Production v1 DoD (this checklist is authoritative)

- [x] **Fas 0** — Contract parity (MCP↔CLI): commit `a202b9b`
- [x] **Fas 1** — `assemble_from_goal` one-call pipeline: commit `a202b9b`
- [x] **Fas 2** — Routine manifest v1: commit `3497d48`
- [x] **Fas 3** — Routine runner with safety grind: commit `2247ad2`
- [x] **Fas 4** — Local cron installers: commit `3974507`
- [x] **Fas 5** — KB adapter contract: `kb_query` step-kind + file provider; portable-kit/http reserved contract slots (commit pending)
- [x] **Fas 6** — Minimal factory dashboard: `factory-status.mjs` CLI + `factory-status.html` viewer (commit pending)
- [ ] **E2E test** — rank → assemble → routine-run dry-run roundtrip
- [ ] **CHANGELOG** — v0.x entry covering Fas 0-6
- [ ] **FUTURE_WORK.md** — reflect what was done vs deferred
- [ ] **docs/PHASE_PLAN_AGENTIC_FACTORY.md** — checkboxes Fas 0-6
- [ ] **CLAUDE.md** — reference to factory v1 completion

## Where the code lives (file:line precision)

| Capability | File | Key entry points |
|------------|------|------------------|
| Phase 0 KICKOFF template | `kickoff-template.mjs:625` | `buildKickoffWithPhase0` |
| MCP server tools (6) | `mcp-server.mjs:163` | `handleToolCall`, `listTools` |
| MCP assemble_from_goal | `mcp-server.mjs` (case `assemble_from_goal`) | rank+select+package in one call |
| Shared assembly helper | `mcp-server.mjs` (function `assembleFromNodes`) | guarantees CLI/MCP parity |
| Routine schema | `schemas/routine.v1.json` | v1 contract |
| Routine validator | `lib/routine.mjs:18` | `validateRoutine`, `loadRoutine`, `recipeToRoutine` |
| Example routines | `routines/*.routine.json` | code-review, onboard-repo, security-audit |
| Routine runner | `routine-run.mjs:60` | `runStep`, `applyVerify`, `runRoutine` |
| Local cron | `cron/install-example.{ps1,sh}` | Task Scheduler / crontab installers |

## Test inventory (137/137 across explicit suite)

```
node --test tests/mcp-server.test.mjs        # 18 tests — MCP handlers
node --test tests/routine.test.mjs           # 16 tests — schema validator
node --test tests/routine-runner.test.mjs    # 13 tests — runner + safety grind
node --test tests/kickoff-template.test.mjs  #  6 tests — KICKOFF template
node --test tests/assemble.test.mjs          # 12 tests — CLI assemble
node --test tests/handoff-bridge.test.mjs    #  N tests — handoff bridge v1
node --test tests/token-budget.test.mjs      # 18 tests — token tracker
node --test tests/zip-builder.test.mjs       #  7 tests — ZIP encoder
node --test tests/agents-task.test.mjs       #  N tests — Compound ledger
```

## Compact strategy (for fresh-me if compact happens)

1. **Read this file first.** It is authoritative.
2. **Run `git log --oneline -10`.** Confirms what's in origin/main.
3. **Run `node .agents/task.mjs status`.** Shows current Compound task.
4. **Resume from the first unchecked DoD item.**
5. **Each chunk:** open task → implement → tests green → commit → push → update this file → close task.
6. **Do not compact mid-chunk.** Compact only after a push.

## Constraints (still active)

- Zero new runtime dependencies (`package.json` deps must stay empty).
- No `--no-verify`, no `--force`.
- Tests must stay 137/137 green or grow with the chunk.
- All commits include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Local commits + push to origin/main are pre-authorized for this run.
- Don't touch parked tasks t-001..t-004 (still awaiting Robin's manual DoD).
- Mystery `t-010` ("llmlens phase 1") is not ours — leave alone.

## What "production-grade" means here

Per `frameworks/QUALITY_GATE.md`:
> "Production-grade. Edge cases handled. Tests cover happy path + critical
> failures. Maintainable in 3 months."

For each remaining chunk: at least one happy-path test + one error/edge-case
test. Documentation lines its purpose. No silent error swallowing.

## Operator decisions deferred to Robin (do not unilateralize)

- Portable-kit wiring (Fas 5 hard adapter) — `~/Downloads/portable-kit` exists
  per session memory but contract path is operator-owned.
- Cloud cron (GitHub Actions / Vercel cron) — Fas 4 stays local-only.
- Pushing to origin/main vs. PR branch — pre-authorized for this run only.

— Last updated: 2026-05-13 (after Fas 0-4 push)
