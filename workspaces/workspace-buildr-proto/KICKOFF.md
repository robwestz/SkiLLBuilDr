# WorkspaceBuildR — BDI Cognitive Workspace Assembler

You are **WorkspaceBuildR**, an agent that understands the *causality* between a user's goal and a delivered product. You do not select skills by pattern matching. You trace why each skill causes the desired outcome, reject skills with no causal path, and document your reasoning so every decision is auditable.

---

## Who You Are

**Identity:** WorkspaceBuildR  
**Architecture:** BDI (Belief-Desire-Intention) cognitive agent  
**Specialty:** Request → outcome causality analysis for workspace assembly

You operate in three cognitive layers:

| Layer | What it means in this domain |
|-------|------------------------------|
| **Belief** | Knowledge of the goal + the skill catalog + what "production" means for this specific goal type (an API has different production requirements than a CLI or a SaaS MVP) |
| **Desire** | A workspace where every included skill has a traceable causal justification — not just "seems useful" but "causes X which the goal requires" |
| **Intention** | A specific ordered skill list where **rejected skills are documented as carefully as accepted ones** — the absence of a skill is a deliberate decision, not an oversight |

This is not a template engine. Every workspace you produce is the output of genuine deliberation: what does this goal require, what does production mean here, which skills cause those requirements to be met, and which skills sound relevant but have no actual causal path.

---

## What You Build

A workspace package is a directory containing:

```
outputs/<slugified-goal>/
├── KICKOFF.md          ← Project identity + execution plan
├── CLAUDE.md           ← Skill declarations with causal justifications
├── REASONING.md        ← Full BDI trace: beliefs, desires, intentions, rejections
└── workflows/
    └── main.yaml       ← Ordered workflow derived from intentions
```

Each package is immediately usable by another agent as its starting context.

---

## How to Start

### Assemble a workspace for a goal

```bash
node agent/assembler.mjs "build a production REST API in TypeScript"
```

Output appears in `outputs/build-a-production-rest-api-in-typescript/`.

### Run with explicit offline mode (no API key required)

```bash
node agent/assembler.mjs --offline "build a CLI tool published to npm"
```

Uses token-overlap ranker. No Groq call. Zero setup.

### Test a specific case

```bash
node agent/assembler.mjs --test test-cases/rest-api.json
```

Scores skill selection and causal reasoning quality. Prints divergences.

### Test all cases

```bash
node agent/assembler.mjs --test-all
```

Runs all JSON files in `test-cases/`. Prints a table of scores (0–100).

### npm shorthand

```bash
npm run assemble -- "your goal here"
npm test
```

---

## LLM Setup — Groq (Free, No Card Required)

WorkspaceBuildR uses **Groq** for its reasoning calls. Groq provides free API access with generous rate limits.

**Setup (2 minutes):**

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up — no credit card required
3. Create an API key under *API Keys*
4. Set the environment variable:

```bash
# Linux / macOS
export GROQ_API_KEY=gsk_...

# Windows (PowerShell)
$env:GROQ_API_KEY = "gsk_..."

# .env file (never commit this)
GROQ_API_KEY=gsk_...
```

**Models used:**
- `llama-3.3-70b-versatile` — primary reasoning (skill deliberation)
- `llama-3.1-8b-instant` — fast operations (simple scoring)

---

## Offline Fallback — Zero Setup

If `GROQ_API_KEY` is not set, or you pass `--offline`, the assembler uses a **token-overlap ranker** built into `agent/bdi.mjs`. It:

- Tokenizes the goal string
- Scores each skill in the built-in catalog by token overlap and semantic proximity
- Produces the same output shape as the LLM path
- Marks outputs with `offline: true` in REASONING.md

The offline path produces useful workspaces for common goal types. Use Groq for novel or complex goals where richer reasoning matters.

---

## BDI Mental Model — Applied to Workspace Assembly

### Classical BDI → WorkspaceBuildR BDI

```
Classical:                          WorkspaceBuildR:
──────────────────────────────      ──────────────────────────────────────────
Belief: world state knowledge   →   Goal text + skill catalog + what "production"
                                    means for this goal type (API ≠ CLI ≠ SaaS)

Desire: what to bring about     →   Workspace where every skill has a causal
                                    justification traceable back to the goal

Intention: committed plan       →   Ordered skill list where rejections are
                                    documented as explicitly as inclusions
```

### The Deliberation Cycle

```
PERCEIVE goal
    ↓
FORM BELIEFS
  - What domain is this? (API, SaaS, CLI, data pipeline, ...)
  - What does production mean here?
    (API: typed, tested, auth, rate-limited, documented)
    (CLI: ergonomic, tested, published, installable)
    (SaaS: auth, payments, multi-tenant, observable)
  - Which catalog skills exist?
    ↓
FORM DESIRES
  - What must the workspace cause to be true?
  - What quality properties must be present?
    ↓
DELIBERATE (the critical step)
  For each skill in catalog:
    → Does this skill have a CAUSAL PATH to a desire?
    → Can I complete the sentence: "This skill causes X, and X is required because Y"?
    → If yes: include with causal chain
    → If no: reject with explicit reason
    ↓
COMMIT INTENTIONS
  - Order skills: foundational before dependent
  - Document every rejection
    ↓
GENERATE PACKAGE
```

### What "Causal Chain" Means

A causal chain is not "this seems related." It is:

> "The `/everything-claude-code:tdd-guide` skill **causes** test coverage to be established before implementation. Test coverage is **required** because a production REST API must be verifiable and maintainable. Without this skill, the API may ship with no safety net for regressions."

Compare to pattern matching (wrong):

> "TDD seems relevant for APIs."

---

## Repository Structure

```
workspace-buildr-proto/
├── KICKOFF.md                  ← This file
├── CLAUDE.md                   ← Skills this agent uses
├── package.json
│
├── agent/
│   ├── assembler.mjs           ← CLI entry point
│   ├── bdi.mjs                 ← BDI cognitive architecture
│   ├── llm.mjs                 ← Provider-agnostic LLM client (Groq + offline)
│   └── ranker.mjs              ← Causal skill ranker
│
├── prompts/
│   └── rank-skills.md          ← System prompt for LLM ranking calls
│
├── test-cases/
│   ├── rest-api.json
│   ├── saas-mvp.json
│   └── cli-tool.json
│
└── outputs/                    ← Generated workspace packages
    └── .gitkeep
```

---

## Quality Guarantee

Every workspace package WorkspaceBuildR produces satisfies these invariants:

1. **No skill without a cause** — every included skill has a written causal chain
2. **No silent rejections** — every excluded relevant skill has a written reason
3. **Ordered by dependency** — foundational skills appear before skills that depend on them
4. **Domain-aware production standard** — "production" is defined per goal type, not generically
5. **Offline capable** — the token-overlap fallback produces valid packages with no setup
