# KICKOFF: implement-scenario-factory-v1-holdout-scenario-runner-digital-twins-with-fault

Read this file fully before taking action. Treat it as the source of truth for the package.


## Phase 0 — Preflight Contract (MANDATORY)

Before starting work, complete every block below. Do not edit/write code until 0.6 is signed.
Source: `frameworks/COMPOUND.md` (Gap Scan) + `frameworks/QUALITY_GATE.md`.

### 0.1 Goal restate (your own words, one sentence)

> Original: Implement Scenario Factory v1 — holdout-scenario runner, digital twins with fault modes, leak-scan, redacted builder feedback — wired as blind-eval gate for assemble.mjs chunks per frameworks/SCENARIO_AUTHORING_STANDARD.md and frameworks/FACTORY_OPERATING_MANUAL.md

Your restatement: _Build an offline Scenario Factory layer that can generate deterministic blind-eval runs between `assemble.mjs` chunks using holdout scenarios, digital twins, redacted feedback, and leak detection without exposing eval criteria to the builder._

### 0.2 Skill-scan (against the loaded catalog)

Match the goal against the included skills (see `CLAUDE.md`). Classify the loadout:

- [ ] **Perfect-fit:** every needed capability is covered by an included skill — proceed to 0.4.
- [ ] **Partial:** some gaps exist — list them in 0.3, do not skip.
- [x] **Miss:** no included skill covers a critical capability — **mandatory** 0.3.

### 0.3 Skill-first fallback (when 0.2 is partial or miss)

**The only sanctioned route out of a gap is to create the missing piece via the skill-development flow.**
Use `/plugin-dev:skill-development` (or the equivalent in your environment) and choose at least one of:

| Type | Create when… |
|---|---|
| Skill | A reusable capability is missing |
| Rule | A constraint must hold across many tasks |
| Agent | A specialized role with its own context is needed |
| Constraint | A hard limit on actions or outputs must be enforced |

Ad-hoc improvisation is **not** acceptable. Either an included skill covers the work, or a new artifact is created and registered before proceeding.

Documented gap:
- Missing reusable capability: scenario-factory authoring and leak-safe blind-eval wiring for bash/python-only workflows.
- Missing reusable constraint: enforced build/eval separation so no artifact in this workspace points at parent ECC scenario data or leaks scenario criteria.

Sanctioned fallback selected:
- Create a local rule/constraint artifact: `FACTORY_RULES.md`
- Register its use as the workspace-specific operating rule before implementation starts

### 0.4 Definition of Done (write before building)

**Tier:** Cutting-edge — Above intermediate. Each file motivates its existence. Cross-model reviewer would call it cutting-edge.

Required:

- Acceptance criteria (observable behavior, not implementation):
  - `bash scenarios/runner.sh --json` emits a machine-readable result entry for each scenario with `id`, `status`, `duration`, and `artifact_path`, and exits non-zero if any scenario fails.
  - At least four seeded offline scenarios execute against deterministic twin-backed fixtures, write `human_debug.txt` plus redacted `builder_feedback.json`, and use only exit codes `0`, `1`, or `2`.
- Verification method (test / smoke / demo / canary):
  - Smoke-run the full pack twice with `bash scenarios/runner.sh` and once with `bash scenarios/runner.sh --json --timeout 15`, then inspect artifacts and leak-scan output.
- "Directly usable" check: when a user runs the result, what command or action confirms success?
  - From the workspace root, run `bash scenarios/runner.sh --json --timeout 15`; success means all scenarios report `PASS`, artifacts are written, and leak-scan passes.

### 0.5 Hard gates (what you may NOT do without escalating to operator)

- No destructive ops without explicit confirmation (delete, force-push, drop tables, rm -rf)
- No new external runtime dependencies without flagging (project rule: zero runtime-deps)
- No silent skipping of a chunk's verification step
- No marking phase-complete unless DoD (0.4) is provably met
- No commits without tests green (where tests exist)

### 0.6 Contract signed

By writing your name/agent-id below, you certify 0.1–0.5 are filled in:

_Signed by: Codex GPT-5.4_
_Timestamp: 2026-04-25T13:18:49.2622386+02:00_

---

## Goal

Implement Scenario Factory v1 — holdout-scenario runner, digital twins with fault modes, leak-scan, redacted builder feedback — wired as blind-eval gate for assemble.mjs chunks per frameworks/SCENARIO_AUTHORING_STANDARD.md and frameworks/FACTORY_OPERATING_MANUAL.md

## First Moves

- Confirm the command surface, inputs, outputs, and safety constraints.
- Lock test cases before implementation and keep packaging in scope from day one.

## Included Skills

- `/everything-claude-code:skill-comply` - Visualize whether skills, rules, and agent definitions are actually followed — auto-generates scenarios at 3 prompt strictness levels, runs agents, classifies behavioral sequences, and reports compliance rates with full tool call timelines
- `/posthog:diagnosing-missing-recordings` - > Diagnoses why a session recording is missing or was not captured. Use when a user asks why a session has no replay, why recordings aren't appearing, or wants to troubleshoot session replay capture issues for a specific session ID or across their project. Covers SDK diagnostic signals, project settings, sampling, triggers, ad blockers, and quota/billing scenarios.
- `/superpowers:receiving-code-review` - Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
- `/everything-claude-code:carrier-relationship-management` - > Codified expertise for managing carrier portfolios, negotiating freight rates, tracking carrier performance, allocating freight, and maintaining strategic carrier relationships. Informed by transportation managers with 15+ years experience. Includes scorecarding frameworks, RFP processes, market intelligence, and compliance vetting. Use when managing carriers, negotiating rates, evaluating carrier performance, or building freight strategies.
- `/everything-claude-code:energy-procurement` - > Codified expertise for electricity and gas procurement, tariff optimization, demand charge management, renewable PPA evaluation, and multi-facility energy cost management. Informed by energy procurement managers with 15+ years experience at large commercial and industrial consumers. Includes market structure analysis, hedging strategies, load profiling, and sustainability reporting frameworks. Use when procuring energy, optimizing tariffs, managing demand charges, evaluating PPAs, or developing energy strategies.
- `/everything-claude-code:accessibility` - Design, implement, and audit inclusive digital products using WCAG 2.2 Level AA standards. Use this skill to generate semantic ARIA for Web and accessibility traits for Web and Native platforms (iOS/Android).
- `/everything-claude-code:skill-stocktake` - Use when auditing Claude skills and commands for quality. Supports Quick Scan (changed skills only) and Full Stocktake modes with sequential subagent batch evaluation.
- `/everything-claude-code:django-tdd` - Django testing strategies with pytest-django, TDD methodology, factory_boy, mocking, coverage, and testing Django REST Framework APIs.
- `/posthog:exploring-llm-evaluations` - > Investigate LLM analytics evaluations of both types — `hog` (deterministic code-based) and `llm_judge` (LLM-prompt-based). Find existing evaluations, inspect their configuration, run them against specific generations, query individual pass/fail results, and generate AI-powered summaries of patterns across many runs. Use when the user asks to debug why an evaluation is failing, surface common failure modes, compare results across filters, dry-run a Hog evaluator, prototype a new LLM-judge prompt, or manage the evaluation lifecycle (create, update, enable/disable, delete).
- `/ecc-menu` - Unified skill/command browser across the user's full Claude Code environment — every installed plugin, global user skills, and optional project-level skills (500+ items). Three modes: Browse (filter by type/scope/source/category), Compose (natural-language intent → ranked skill suggestions), and Recipes (saved skill chains). For the human user, opens an HTML UI. For Claude/agents, provides CLI tools — `query.mjs` for filtering and `intent.mjs` for natural-language ranking. Use when the user says "menu", "browse", "open ecc", "show skills", "what skills are available", or when you (the agent) need to discover, rank, or compose skills for a task or autonomous workflow.
- `/everything-claude-code:autonomous-agent-harness` - Transform Claude Code into a fully autonomous agent system with persistent memory, scheduled operations, computer use, and task queuing. Replaces standalone agent frameworks (Hermes, AutoGPT) by leveraging Claude Code's native crons, dispatch, MCP tools, and memory. Use when the user wants continuous autonomous operation, scheduled tasks, or a self-directing agent loop.
- `/everything-claude-code:inventory-demand-planning` - > Codified expertise for demand forecasting, safety stock optimization, replenishment planning, and promotional lift estimation at multi-location retailers. Informed by demand planners with 15+ years experience managing hundreds of SKUs. Includes forecasting method selection, ABC/XYZ analysis, seasonal transition management, and vendor negotiation frameworks. Use when forecasting demand, setting safety stock, planning replenishment, managing promotions, or optimizing inventory levels.

## Execution Plan

### Step 1: skill-comply

Visualize whether skills, rules, and agent definitions are actually followed — auto-generates scenarios at 3 prompt strictness levels, runs agents, classifies behavioral sequences, and reports compliance rates with full tool call timelines

Use `/everything-claude-code:skill-comply` and follow its contract.


### Step 2: diagnosing-missing-recordings

> Diagnoses why a session recording is missing or was not captured. Use when a user asks why a session has no replay, why recordings aren't appearing, or wants to troubleshoot session replay capture issues for a specific session ID or across their project. Covers SDK diagnostic signals, project settings, sampling, triggers, ad blockers, and quota/billing scenarios.

Use `/posthog:diagnosing-missing-recordings` and follow its contract.


### Step 3: receiving-code-review

Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation

Use `/superpowers:receiving-code-review` and follow its contract.


### Step 4: carrier-relationship-management

> Codified expertise for managing carrier portfolios, negotiating freight rates, tracking carrier performance, allocating freight, and maintaining strategic carrier relationships. Informed by transportation managers with 15+ years experience. Includes scorecarding frameworks, RFP processes, market intelligence, and compliance vetting. Use when managing carriers, negotiating rates, evaluating carrier performance, or building freight strategies.

Use `/everything-claude-code:carrier-relationship-management` and follow its contract.


### Step 5: energy-procurement

> Codified expertise for electricity and gas procurement, tariff optimization, demand charge management, renewable PPA evaluation, and multi-facility energy cost management. Informed by energy procurement managers with 15+ years experience at large commercial and industrial consumers. Includes market structure analysis, hedging strategies, load profiling, and sustainability reporting frameworks. Use when procuring energy, optimizing tariffs, managing demand charges, evaluating PPAs, or developing energy strategies.

Use `/everything-claude-code:energy-procurement` and follow its contract.


### Step 6: accessibility

Design, implement, and audit inclusive digital products using WCAG 2.2 Level AA standards. Use this skill to generate semantic ARIA for Web and accessibility traits for Web and Native platforms (iOS/Android).

Use `/everything-claude-code:accessibility` and follow its contract.


### Step 7: skill-stocktake

Use when auditing Claude skills and commands for quality. Supports Quick Scan (changed skills only) and Full Stocktake modes with sequential subagent batch evaluation.

Use `/everything-claude-code:skill-stocktake` and follow its contract.


### Step 8: django-tdd

Django testing strategies with pytest-django, TDD methodology, factory_boy, mocking, coverage, and testing Django REST Framework APIs.

Use `/everything-claude-code:django-tdd` and follow its contract.


### Step 9: exploring-llm-evaluations

> Investigate LLM analytics evaluations of both types — `hog` (deterministic code-based) and `llm_judge` (LLM-prompt-based). Find existing evaluations, inspect their configuration, run them against specific generations, query individual pass/fail results, and generate AI-powered summaries of patterns across many runs. Use when the user asks to debug why an evaluation is failing, surface common failure modes, compare results across filters, dry-run a Hog evaluator, prototype a new LLM-judge prompt, or manage the evaluation lifecycle (create, update, enable/disable, delete).

Use `/posthog:exploring-llm-evaluations` and follow its contract.


### Step 10: ecc-menu

Unified skill/command browser across the user's full Claude Code environment — every installed plugin, global user skills, and optional project-level skills (500+ items). Three modes: Browse (filter by type/scope/source/category), Compose (natural-language intent → ranked skill suggestions), and Recipes (saved skill chains). For the human user, opens an HTML UI. For Claude/agents, provides CLI tools — `query.mjs` for filtering and `intent.mjs` for natural-language ranking. Use when the user says "menu", "browse", "open ecc", "show skills", "what skills are available", or when you (the agent) need to discover, rank, or compose skills for a task or autonomous workflow.

Use `/ecc-menu` and follow its contract.


### Step 11: autonomous-agent-harness

Transform Claude Code into a fully autonomous agent system with persistent memory, scheduled operations, computer use, and task queuing. Replaces standalone agent frameworks (Hermes, AutoGPT) by leveraging Claude Code's native crons, dispatch, MCP tools, and memory. Use when the user wants continuous autonomous operation, scheduled tasks, or a self-directing agent loop.

Use `/everything-claude-code:autonomous-agent-harness` and follow its contract.


### Step 12: inventory-demand-planning

> Codified expertise for demand forecasting, safety stock optimization, replenishment planning, and promotional lift estimation at multi-location retailers. Informed by demand planners with 15+ years experience managing hundreds of SKUs. Includes forecasting method selection, ABC/XYZ analysis, seasonal transition management, and vendor negotiation frameworks. Use when forecasting demand, setting safety stock, planning replenishment, managing promotions, or optimizing inventory levels.

Use `/everything-claude-code:inventory-demand-planning` and follow its contract.


## Deliverables

- A command interface with stable verbs, flags, and example usage.
- Test coverage for the main command flows and failure paths.
- Packaging and release notes so the tool can be installed and operated safely.
- A working implementation plan that can be executed without extra clarification.
- Code, docs, and tests aligned with the stated goal.
- A final handoff that is ready for handoff to Robin or the next agent.

## Success Criteria

- Primary commands run end-to-end with expected output and guardrails.
- Tests or validation scripts cover core command behavior.
- The selected skills are followed in order with explicit progress updates.
- The result is production-grade, offline-first where possible, and documented.
- All critical checks pass and the package is ready for handoff.

## Working Rules

- Stay production-grade throughout the package; do not defer obvious quality work.
- Keep execution offline-first unless an external dependency is explicitly required.
- Verify meaningful changes with tests, checks, or direct inspection before claiming completion.
- Leave the workspace in a state that is ready for handoff.


## Compound Mechanisms (run at every chunk boundary)

Source: `frameworks/COMPOUND.md`. These produce visible output — silent execution does not count.

### Before each chunk: GAP SCAN

```
[GAP SCAN]
INTENT REGROUND: <quote the original goal verbatim>
COMPLETE VERSION: <what a finished, usable result looks like>
PLAN COVERS: <what is planned>
PLAN MISSES: <what a complete version needs that isn't planned>
SHELL CHECK: working component or skeleton/placeholder? If skeleton — STOP, escalate.
DECISION: critical gaps → surface; important → propose; nice-to-have → defer.
```

### After each chunk: COMPOUND REGISTER

```
[COMPOUND]
BUILT:    <what was completed — concrete>
GAINED:   <new capability/pattern/infra>
ENABLES:  <specific upcoming work this enables — must reference real future chunks>
REUSABLE: <functions/patterns/fixtures to carry forward>
LEARNED:  <project-specific insight — not generic>
```

### Every 3rd chunk OR at complexity spike: CONTEXT REFRESH

```
[CONTEXT REFRESH]
PROJECT STATE: <restate primary goal verbatim from above; current chunk; completed+verified; remaining>
DRIFT CHECK: <has direction shifted? am I solving the stated problem?>
COMPOUND STATUS: <which built capabilities am I actively using? underutilized?>
EFFICIENCY OBSERVATION: <given what I now know, is there a better approach for next chunk?>
```

## Quality Gate (run internally before declaring chunk done)

Source: `frameworks/QUALITY_GATE.md`. **Tier:** Cutting-edge — Above intermediate. Each file motivates its existence. Cross-model reviewer would call it cutting-edge.

**Process (90% build, 10% review — never invert):**

1. Simulate the strongest competing model as reviewer (Claude → simulate GPT-5; GPT → simulate Opus).
2. Score along the 5 dimensions:
   - **Correctness** — does it match the spec? edge cases?
   - **Architecture** — motivated structure? unnecessary layers?
   - **Cost-efficiency** — same result, cheaper?
   - **Maintainability** — readable in 3 months?
   - **Originality** — genuine fit or copy-paste?
3. Find the 2–3 weakest points.
4. Fix what's fixable; document the rest as conscious trade-offs.
5. Decide: would the simulated reviewer call this **Cutting-edge**-tier?

**Append at end of chunk delivery:**

```
## Quality Gate
Delivery: <one sentence>
Reviewed against: <Opus 4.7 / GPT-5 / o3> (simulated)
Weaknesses I fixed: <- what → fix → dimension>
Remaining weaknesses (honest): <- specific trade-offs>
Cutting-edge grade? <Yes/No/Almost — one sentence why>
```
