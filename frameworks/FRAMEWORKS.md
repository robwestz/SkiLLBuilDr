# Frameworks Index

Reference library of reusable agent frameworks imported into this repo.
Each file is a verbatim copy with a provenance comment at the top.

---

## Preflight & Compound

### COMPOUND.md
**What it is:** Three-mechanism execution overlay (Compound Register, Gap Scan, Context Refresh) that hooks into any workflow at phase transitions without replacing it.
**When to use:** At the start of any multi-phase build session where context decay and scope drift are risks; attach to your CLAUDE.md or task runner.
**Source:** `C:\Users\robin\Videos\inventory-system\inventory_agents\COMPOUND-ORIGINAL.md`

### QUALITY_GATE.md
**What it is:** Cross-model adversarial self-review protocol — simulate the competing model as reviewer across five dimensions (correctness, architecture, cost, maintainability, originality).
**When to use:** After completing any deliverable, before handing off; run internally and append only the gate output block to your response.
**Source:** `C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\QUALITY_GATE.md`

---

## Holdout & Eval

### SCENARIO_AUTHORING_STANDARD.md
**What it is:** Authoring spec for holdout scenario scripts (bash `.sh` files) — format rules, determinism requirements, artifact policy, and a copy-paste minimal template.
**When to use:** When writing a new eval scenario for the scenario-driven factory; ensures scenarios are offline, seeded, and safe against criteria leakage.
**Source:** `C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\reference\chatgpt-factory\scenario-authoring-standard.md`

### FACTORY_OPERATING_MANUAL.md
**What it is:** Full operating manual for the Ultima scenario-driven AI factory — three pillars (holdout scenarios, digital twins, spec-as-input), build/eval/triage workflow, feedback discipline, cost policy, and quality gates.
**When to use:** When setting up or running an autonomous build pipeline where a builder agent must never see eval criteria; the primary governance document for the factory.
**Source:** `C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\reference\chatgpt-factory\factory-operating-manual.md`

### THREAT_MODEL_TEACHING_TO_THE_TEST.md
**What it is:** Threat model covering six attack surfaces by which an AI builder can (intentionally or emergently) overfit to eval criteria — with mitigations and pre-holdout checklists.
**When to use:** Before promoting a new scenario to holdout status, or when auditing the factory for leakage risk; run the two checklists at the bottom.
**Source:** `C:\Users\robin\Videos\inventory-system\inventory_agents\the_preparation_research_and_purpose_agent\the_preparation_reserarch_agent\ultima-memory-kit\reference\chatgpt-factory\threat-model-teaching-to-the-test.md`

---

## Multi-agent runtime

### SUBAGENTS.md
**What it is:** Reference documentation for the OpenClaw sub-agent system — spawn behavior, tool policy by depth, Discord thread binding, nested orchestrator pattern, concurrency, and announce protocol.
**When to use:** When implementing parallel/background work via `sessions_spawn`, configuring sub-agent tool policy, or troubleshooting thread-bound sessions.
**Source:** `C:\Users\robin\Videos\inventory-system\inventory_agents\subagents.md`

### MEMORY_ARCHITECT.md
**What it is:** Skill definition for the Memory Architect — a two-persona (Researcher + Gatekeeper) workflow for designing and gating strategic Claude memory batches that unlock new capabilities.
**When to use:** When Claude's memory is missing context that causes repeated re-explanation each session; run the weekly workflow to design a batch that passes all five Gatekeeper constraints.
**Source:** `C:\Users\robin\Downloads\dr3mr\regulardr3m\memory-architect-skill.md`
