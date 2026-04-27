# FUTURE_WORK.md

Deferred components for the `assemble.mjs` CLI / KICKOFF package system.
Nothing here blocks tonight's deliverable; everything here is too important to lose.

---

## 1. Token Budget Tracker

**Status:** Not started — net new  
**Why deferred:** Reliably measuring "remaining context tokens" inside a live agent run requires
either Anthropic API introspection endpoints (not yet stable) or heuristic byte-counting that
would be dangerously inaccurate. Shipping a wrong trigger is worse than shipping none.  
**Prerequisites:**
- Study `anthropic.beta.messages.count_tokens` (available in Anthropic SDK ≥ 0.26).
- Determine whether Claude Code exposes `$CLAUDE_CONTEXT_REMAINING` or equivalent env.
- Agree on a conservative safety margin (e.g. trigger at 15 % remaining).

**Rough effort:** 1–2 days (research + thin wrapper + unit tests with mock API).  
**Where this lives:** `[net new]` — suggest `lib/token-budget.mjs`.

---

## 2. Claude ↔ Codex Live Handoff Bridge

**Status:** Not started — net new  
**Why deferred:** Requires the Token Budget Tracker (#1) as a trigger signal, plus a stable
serialization format for mid-task agent state. The triggering mechanism (CLI flag? subagent spawn
via `sessions_spawn`? cron re-entry?) is still an open design decision.  
**Prerequisites:**
- Token Budget Tracker (#1) shipped and proven reliable.
- Define a **Handoff Contract** artifact: JSON schema with fields `{checkpoint_id, completed_chunks[],
  pending_chunks[], open_decisions[], context_summary, timestamp}`.
- Choose trigger mechanism — most likely: `assemble.mjs --resume <handoff.json>` + KICKOFF
  annotation that Codex picks up on next spawn.

**Rough effort:** 3–5 days (schema design, serializer, CLI flag, integration test with two
back-to-back agent runs).  
**Where this lives:** `[net new]` — suggest `lib/handoff-bridge.mjs` + `schemas/handoff-contract.json`.

---

## 3. Generalized N-Persona Debate Substrate ✅ SHIPPED 2026-04-25

**Status:** Shipped as `factory/v2-personas/` (Codex worker P2, commit pending).  
**Where it lives:** `factory/v2-personas/debate.mjs` (runner) + `examples/*.config.json` (3 configs:
memory-architect, release-readiness, operator-ask) + `debate.test.mjs` (5 tests, all green).  
**Adapter contract:** `runDebate(config, proposal, { responder })` returns a
`v2-personas.decision.v1` artifact. Default responder is deterministic; LLM responder is pluggable
via the same interface — no network or runtime deps required.  
**Next integration steps (separate from substrate itself):**
- `assemble.mjs --debate <topic>` flag — wires substrate into KICKOFF Phase 0.4 (see #9 below).
- EVAL LOOP block calls `factory/v2-personas/debate.mjs` instead of agent self-evaluation
  (see #8, now unblocked).

---

## 4. Scenario Factory Wrappers per Chunk

**Status:** Not started — requires CLI integration  
**Why deferred:** The Scenario Authoring Standard and Factory Operating Manual exist as frameworks
but are not yet wired into `assemble.mjs`. Plumbing them into every chunk's completion gate would
extend the CLI surface significantly and deserves its own focused PR.  
**Prerequisites:**
- Read `frameworks/SCENARIO_AUTHORING_STANDARD.md` and `frameworks/FACTORY_OPERATING_MANUAL.md`
  to confirm the current scenario schema and invocation contract.
- Define how a chunk declares its scenario suite (inline KICKOFF front-matter or sidecar `.scenarios.json`).
- Wire `assemble.mjs` to run the factory and fail-fast if holdout pass rate < threshold.

**Rough effort:** 2–3 days (CLI plumbing + scenario runner adapter + at least 2 reference chunk
scenarios).  
**Where this lives:** Seeds → `frameworks/SCENARIO_AUTHORING_STANDARD.md`,
`frameworks/FACTORY_OPERATING_MANUAL.md`; new code → `lib/scenario-runner.mjs`.

---

## 5. MVP-Tier Quality Gate

**Status:** Partially defined — cutting-edge tier only  
**Why deferred:** The current Quality Gate enforces cutting-edge thresholds (coverage, latency,
error budget). Adding MVP and Production tiers requires policy decisions (what trade-offs are
acceptable at each tier?) that should be owned by a human reviewer, not auto-generated.  
**Prerequisites:**
- Read `frameworks/QUALITY_GATE.md` to inventory existing threshold fields.
- Hold a brief stakeholder review to agree on MVP thresholds (e.g. 60 % coverage, 2× latency
  budget, no SLA).
- Add a `--tier [mvp|production|cutting-edge]` flag to gate evaluation.

**Rough effort:** 1 day (schema extension + flag plumbing + docs update).  
**Where this lives:** Seed → `frameworks/QUALITY_GATE.md`; changes in-place + CLI flag.

---

## 6. Subagent Runtime Integration in Packages

**Status:** Not started — KICKOFF is currently static markdown  
**Why deferred:** Allowing KICKOFF.md to invoke `sessions_spawn` automatically requires trusting
KICKOFF content as executable, which is a security/trust-boundary decision. Also depends on the
hosting runtime supporting subagent spawning (not guaranteed on all Claude Code versions).  
**Prerequisites:**
- Read `frameworks/SUBAGENTS.md` to understand the current `sessions_spawn` contract and
  permission model.
- Decide on a safe invocation syntax (e.g. KICKOFF front-matter declares `parallelizable: true`
  and `assemble.mjs` — not KICKOFF itself — calls `sessions_spawn`).
- Add integration test that verifies two parallel chunks complete and merge results correctly.

**Rough effort:** 2–4 days (design + runtime adapter + guard-rails + integration test).  
**Where this lives:** Seed → `frameworks/SUBAGENTS.md`; new code → `lib/subagent-spawner.mjs`.

---

## 7. Logical-Order Chunk DAG Designer

**Status:** Not started — net new tooling  
**Why deferred:** Current chunk ordering is human-driven inside KICKOFF.md. Building a DAG tool
that takes `{chunks, dependencies}` and emits an executable plan with parallelizable nodes marked
is valuable but not required for the first working package. It is also a non-trivial graph problem
(cycle detection, critical-path scheduling).  
**Prerequisites:**
- Choose a graph library or implement topological sort in pure ESM (no heavy deps).
- Define the input schema: each chunk declares `id`, `depends_on[]`, `estimated_minutes`,
  `parallelizable` hint.
- Output format: ordered stages where each stage is a set of chunks safe to run concurrently.
- Hook output into `assemble.mjs --plan` dry-run mode.

**Rough effort:** 2–3 days (graph engine + schema + CLI flag + visual ASCII output for
human review).  
**Where this lives:** `[net new]` — suggest `lib/dag-designer.mjs` + `schemas/chunk-graph.json`.

---

## 8. Live Eval Loop Replacing User Asks

**Status:** Unblocked 2026-04-25 — #3 shipped; integration in progress.  
**Why deferred (until 2026-04-25):** This is the highest-leverage but also highest-risk feature:
replacing interactive user prompts with an autonomous mini-debate means an agent can go fully
dark for multi-hour runs. Required the N-Persona Debate Substrate (#3) to be stable first, plus
a confidence threshold below which escalation to the human is still mandatory.  
**Prerequisites:**
- N-Persona Debate Substrate (#3) shipped.
- Define an `escalation_policy`: minimum confidence score, maximum debate rounds, and a
  mandatory-escalation list of question categories (cost >$X, destructive ops, external API calls).
- Replace `assemble.mjs` `--ask` hook with `lib/eval-loop.mjs` that runs the debate and only
  surfaces unresolved questions to the user.
- Observability: every auto-resolved question must be logged with the winning persona's rationale.

**Rough effort:** 3–4 days (eval-loop driver + escalation policy config + logging + integration
test simulating a full no-human-ask run).  
**Where this lives:** Seeds → `lib/debate.mjs` (from #3); new code → `lib/eval-loop.mjs`.

---

## 9. Assembler Wiring for Debate + Auto-Skill-Dev

**Status:** Net new — added 2026-04-25 to track ongoing CLI integration.  
**Why this exists separately:** #3 ships the substrate; #8 ships the eval-loop policy. This item
covers the glue inside `assemble.mjs` and `kickoff-template.mjs` so a generated package carries:

- `--debate "<topic>"` flag → emits a "Pre-decision debate" block in KICKOFF Phase 0.4 with a
  paste-ready `factory/v2-personas/debate.mjs` invocation.
- `--auto-phase0` skill-scan = `partial`/`miss` → KICKOFF Phase 0.3 contains a concrete
  `/skill-development` invocation block instead of free-form text.
- factory/v2-personas/ bundled into the generated ZIP so the package is still self-contained.

**Where this lives:** `assemble.mjs` (flag + bundling), `kickoff-template.mjs` (block templates).

---

## 10. Compound Protocol Harness ✅ SHIPPED 2026-04-27

**Status:** Shipped as `.agents/` (portable across projects).
**Where it lives:**
- `.agents/PROTOCOL.md` — activation marker + 4 hard rules (no work without task, no switch without parking, no done without active verification, no block without unlock-path)
- `.agents/COMPOUND.md` — 3-mechanism overlay (REGISTER / GAP SCAN / CONTEXT REFRESH)
- `.agents/SKILL_SELECT.md` — skill selection algorithm (perfect-fit / partial / miss → create-new-skill)
- `.agents/DOD.md` — Definition of Done contract with three check types (test / artifact / manual) and active verification flow
- `.agents/PLAN_MARKERS.md` — frontmatter + inline-marker spec for plan-document activation
- `.agents/task.mjs` — zero-dep CLI: status, ack, open, list, show, verify, done, park, resume, block, abandon, update, import + hook handlers (~480 lines)
- `.agents/activate.mjs` — idempotent installer that wires hooks into `.claude/settings.json`
- `.agents/TASKS.json` — open-task ledger
- `tests/agents-task.test.mjs` — 20 tests covering open/park/resume/verify/done/block/import/hooks (all green)

**Hooks installed by `node .agents/activate.mjs`:**
- `SessionStart` → injects current-task summary as additional context
- `PreToolUse:Edit|Write` → warns (default) or blocks (`COMPOUND_ENFORCE=1`) when no task in_progress
- `Stop` → updates `updated_at` checkpoint on current task

**Plan-document activation:** YAML frontmatter `compound: active` + `phases: [...]` or inline `[COMPOUND-PHASE id=... goal=... dod="..." skills="..."]`. Imported via `node .agents/task.mjs import <plan> --apply`.

**Portability:** `cp -r .agents/ /path/to/new-repo/ && node .agents/activate.mjs`. Zero runtime deps, Node 18+.

**What this addresses:** Operator's gap-finding 2026-04-27 — tasks dropping silently between conversations, no DoD enforcement for ad-hoc work, no continuity gate, hooks blocking without unlock-path. Now machine-enforced rather than instruction-followed.

**Next steps (separate work, not blocking):**
- Wire `assemble.mjs` to emit `compound: active` frontmatter in generated KICKOFF.md (auto plan-marker bridge)
- Add `task verify` smoke check inside `demo-autonomous-loop.sh` so the loop can't claim done without DoD
- Promote enforcement mode default after dogfooding stabilizes

---

*Last updated: 2026-04-27. All estimates are single-engineer, focused-session days.*
