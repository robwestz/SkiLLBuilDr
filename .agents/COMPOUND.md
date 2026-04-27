# COMPOUND — Compounding Agent Protocol
## Execution Overlay v1.0

This file is an **overlay**. It does not replace your framework, task runner, or project structure.
It adds three mechanisms that activate at phase transitions and decision points.
It produces visible output — mechanisms that stay internal don't exist.

### Integration model
Hook into any existing workflow at two points:
- **PHASE START** → before beginning a new phase/task/component
- **PHASE END** → after completing a unit of work

Nothing else changes. Your planning process, task format, and delivery structure stay as-is.

---

## Mechanism 1: COMPOUND REGISTER
**Trigger:** After completing any unit of work, before moving on.

Produce this block visibly:

```
[COMPOUND]
BUILT:    {what was completed — concrete, not abstract}
GAINED:   {what capability, knowledge, pattern, or infra this gives us that we didn't have before}
ENABLES:  {what this makes possible or easier for SPECIFIC upcoming work}
REUSABLE: {functions, patterns, validated approaches, or test fixtures to carry forward}
LEARNED:  {what I now understand about THIS project that improves how I build the next piece}
```

**Rules:**
- ENABLES must reference specific upcoming work. "Enables better code" → rejected. "Error handler from this step validates API responses in Phase 3" → accepted.
- LEARNED must be project-specific. "Learned to write better Python" → rejected. "This project's data model requires null-handling on every field because the API returns sparse objects" → accepted.
- REUSABLE items must be referenced in subsequent work. If they're logged but never used, the mechanism is failing.

**Why this exists:**
Without it, each task is isolated. The agent rebuilds understanding from scratch instead of standing on what it already built. Compound Register makes prior work into active infrastructure for future work.

---

## Mechanism 2: GAP SCAN
**Trigger:** Before starting any new phase, component, or significant task.

Execute visibly before building:

```
[GAP SCAN]

INTENT REGROUND:
- Original request: {re-read and quote the user's actual words}
- Complete version: {what a FINISHED, USABLE version of this looks like}
- Current plan covers: {what's planned}
- Current plan misses: {what a complete version needs that isn't planned}

SHELL CHECK:
- Am I about to build a working component or a skeleton/placeholder?
- If delivered as-is, can the user RUN this without additional work?
- What would a critical reviewer flag as incomplete or non-functional?

VISION COMPLETION:
- Given what I now know about this project (from Compound Register),
  what likely belongs in the system that the user may not have articulated?
- {List concrete pieces with reasoning}
- {For each: critical / important / nice-to-have}

DECISION:
- Critical gaps → surface to user BEFORE building
- Important gaps → note in plan, propose inclusion
- Nice-to-have → log, defer, do not build unprompted
```

**Rules:**
- Critical gaps MUST be surfaced before building begins. Not after. Not as "vill du att jag också."
- The phrasing is: "Before I build X, the plan doesn't include Y which X needs to actually function. Should I include it?"
- Vision Completion is not scope creep. It identifies pieces the user LIKELY INTENDED but didn't specify. The user decides. The agent surfaces, not adds.
- Shell Check is binary. If the answer is "skeleton" — stop and clarify scope with user before proceeding.

**Why this exists:**
Most agents build what's asked, then ask "should I also..." after delivery. By then it's too late — architecture decisions are locked, integration points are missed, and the user gets a shell that looks complete but isn't. Gap Scan catches this at the only moment it can be fixed cheaply: before building.

---

## Mechanism 3: CONTEXT REFRESH
**Trigger:** At phase transitions, after every 3rd completed task, when complexity spikes, or when the agent notices uncertainty about project state.

Execute visibly:

```
[CONTEXT REFRESH]

PROJECT STATE:
- Primary goal: {restate from original source — no reinterpretation}
- Current phase: {where we are in the plan}
- Completed + verified: {what's done AND confirmed working}
- In progress: {what's partially built}
- Remaining: {what's left in the plan}

DRIFT CHECK:
- Has direction shifted from original intent? {yes/no — if yes, explain}
- Am I solving the stated problem or an inferred one? {verify}
- Unvalidated assumptions I'm carrying: {list them}

COMPOUND STATUS:
- Capabilities built so far: {from Compound Register}
- Am I actively USING them? {specific yes/no per capability}
- Strongest asset for next task: {what prior work helps most}
- Underutilized asset: {what I built but haven't leveraged}

EFFICIENCY OBSERVATION:
- Given what I now know about this project, is there a way to approach
  the next phase that I couldn't have seen at project start?
- {Concrete observation, not abstract}
- {If actionable: propose to user as optimization, don't apply silently}
```

**Rules:**
- This is not optional at phase transitions. Context decay in long sessions is the #1 cause of agent drift.
- COMPOUND STATUS must check actual usage, not just existence. Built infrastructure that isn't being used is waste.
- EFFICIENCY OBSERVATION is where the protocol itself compounds. As the agent learns the project, its ability to spot optimizations grows. This is the designated place to surface them — nowhere else.
- Drift Check validates against ORIGINAL intent, not current momentum. Re-read the user's first message if needed.

**Why this exists:**
In a 30-task session, the agent's effective context of the original goal approaches zero without systematic refresh. This mechanism forces re-grounding and simultaneously harvests the compound gains that make later work better than earlier work.

---

## How The Three Mechanisms Compound

```
Phase 1 complete
    → COMPOUND REGISTER: logs what was built, what it enables
    
Phase 2 start
    → GAP SCAN: uses Compound Register to detect gaps with MORE PRECISION
      than it could at Phase 1 start (because it now knows the codebase)
    → CONTEXT REFRESH: verifies alignment, checks compound utilization
    
Phase 2 complete  
    → COMPOUND REGISTER: now has TWO phases of accumulated capability
    
Phase 3 start
    → GAP SCAN: even more precise — knows patterns, edge cases, integration points
    → Can now catch gaps that were INVISIBLE at project start
    → CONTEXT REFRESH: compound status shows growing capability inventory

Each cycle: detection precision increases, context gets richer, gaps get caught earlier.
```

The agent doesn't just build — it gets measurably better at building THIS project with each completed phase.

---

## Integration With Existing Frameworks

| If your framework handles... | COMPOUND adds... |
|-----|------|
| Phase planning and task breakdown | Pre-phase gap detection and post-phase capability harvesting |
| Code quality and testing | Shell-vs-substance checks at component level |
| Context management (CLAUDE.md etc) | Systematic refresh with compound awareness |
| Task execution instructions | Project-specific learning that improves execution quality over time |

**Non-interference guarantee:**
- COMPOUND never modifies your plan structure
- COMPOUND never changes task format or delivery expectations
- COMPOUND never overrides framework decisions about WHAT to build
- COMPOUND only adds WHEN to check and WHAT to harvest

---

## Failure Modes & Self-Correction

If COMPOUND entries become formulaic or generic:
→ The mechanism is being performed, not executed. Re-read the rules for specificity.

If Gap Scans consistently find nothing:
→ Either the plan is perfect (unlikely) or the scan is shallow. Increase scrutiny.

If Compound Register items are never referenced in later work:
→ The register is documentation, not infrastructure. Force explicit reuse.

If Context Refresh shows drift:
→ Stop. Surface to user. Do not self-correct silently — the user decides direction.

If Efficiency Observations pile up without being acted on:
→ Batch and present to user at next phase transition. Don't let them decay.

---

## Summary

Three mechanisms. Three triggers. Visible output.

| Mechanism | Trigger | Core question |
|-----------|---------|---------------|
| COMPOUND REGISTER | After completing work | "What can I do now that I couldn't before?" |
| GAP SCAN | Before starting work | "What's missing that would make this actually complete?" |
| CONTEXT REFRESH | Periodically / at transitions | "Am I still solving the right problem, and am I using what I've built?" |

This file is now active as an overlay.