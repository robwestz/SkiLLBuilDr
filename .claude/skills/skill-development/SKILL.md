---
name: skill-development
description: Create a new skill, rule, agent, or constraint when no existing catalog item covers a needed capability. Triggered by Phase 0.3 (skill-first fallback) when the skill-scan returns "partial" or "miss". Produces a registered, validated artifact in this repo's catalog before the agent proceeds with the task that exposed the gap.
---

# Skill Development

The **only sanctioned route** out of a Phase 0.2 "no-fit" or "partial" classification.
When an agent discovers a capability gap, it must stop and run this skill before
improvising. Ad-hoc work in the gap region is forbidden — that is the whole point
of the Preflight Contract.

This skill exists so Phase 0.3 of every KICKOFF has a concrete, machine-followable
procedure attached to it. Without it, the rule "no improvisation" has no escape valve.

---

## When to use

Trigger this skill when **any** of the following is true during Phase 0:

1. Phase 0.2 skill-scan was classified **miss** (no included skill covers a critical capability)
2. Phase 0.2 skill-scan was classified **partial** AND the gap blocks chunk completion
3. Mid-execution, you encounter a capability you assumed was covered but is not
4. You are about to write code/configuration that you cannot point to a covering
   skill, rule, agent, or constraint for

Do **not** use this skill for:
- Trivial tasks that do not need a contract (single-line fixes, status reads)
- Cases where an existing skill fits and you just need to invoke it
- Cases where the gap is in the goal itself (escalate to operator instead — the
  goal is what should change, not the catalog)

---

## Decision tree — which artifact type to create

```
Is the gap a REUSABLE CAPABILITY that other tasks will also need?
├── Yes → SKILL
│         (e.g. "extract structured data from PDFs",
│          "rank skills by causal relevance",
│          "validate a markdown frontmatter block")
│
└── No → Is it a CONSTRAINT that must hold across many tasks?
         ├── Yes → RULE
         │         (e.g. "all SQL migrations must be reversible",
         │          "no commits without tests green",
         │          "no API keys in source files")
         │
         └── No → Does it need its own context window / specialized role?
                  ├── Yes → AGENT
                  │         (e.g. "security-reviewer subagent for OWASP scan",
                  │          "data-pipeline-architect for ETL design")
                  │
                  └── No → It is a HARD LIMIT on what may be done
                           → CONSTRAINT
                           (e.g. "max 1000 lines changed per PR",
                            "no destructive ops without operator approval",
                            "max $5 LLM spend per chunk")
```

**If the answer is unclear, default to SKILL.** It is the most reusable and the
easiest to refactor into one of the other types later.

---

## Inputs required (collect these BEFORE Step 1)

You cannot start without:

- **Gap statement** (one sentence): what capability is missing
- **Triggering goal** (verbatim from KICKOFF 0.1): the goal that exposed the gap
- **Why no existing catalog item fits** (one sentence): which items you considered and rejected
- **Artifact type** (one of: skill / rule / agent / constraint) per the decision tree

If any of the four is "I'll figure it out as I go" — STOP. Re-do Phase 0.2 with more rigor.

---

## Steps (each produces visible output — silent execution does not count)

### Step 1 — Restate the gap as a contract

Produce this block visibly:

```
[GAP CONTRACT]
GAP:        <one sentence: what capability is missing>
TRIGGER:    <KICKOFF goal verbatim>
REJECTED:   <which existing items you considered and why each fails>
TYPE:       <skill | rule | agent | constraint>
NAME:       <kebab-case identifier, e.g. pdf-frontmatter-extractor>
SCOPE:      <project-local | global> (default: project-local — promote later if reused)
```

### Step 2 — Author the artifact from the matching template

Pick the template below by TYPE and fill it in completely. Do not leave placeholders.

#### Template — SKILL

Path: `.claude/skills/<name>/SKILL.md`

```markdown
---
name: <name>
description: <one sentence: what this skill does + when to use it (≤ 200 chars). The catalog ranker uses this verbatim — be specific.>
---

# <Title Case Name>

<One paragraph: the WHAT and the WHEN. Stay concrete.>

## When to use

- <Trigger 1>
- <Trigger 2>

## Inputs

- <Required input 1>
- <Required input 2 — with type / shape>

## Outputs

- <What this produces, including format>

## Steps

1. <Verb-led action with visible output>
2. <Next action>
3. <Verification step>

## Validation

- [ ] <Check 1>
- [ ] <Check 2>

## Examples

<At least one concrete example showing input → output>
```

#### Template — RULE

Path: `.claude/rules/<name>.md`

```markdown
---
name: <name>
description: <one sentence: the constraint, when it applies, what triggers it (≤ 200 chars)>
scope: <session | project | global>
enforcement: <hook | reminder | hard-fail>
---

# Rule: <Title>

## The rule

<One sentence stating the rule itself, in imperative form.>

## Why

<2-3 sentences explaining the cost of breaking this rule. Reference a real
incident or strong preference. The "why" is what lets agents judge edge cases.>

## When this rule fires

- <Trigger condition 1>
- <Trigger condition 2>

## Allowed exceptions

<Either: "None" — or list with explicit operator-approval requirement.>

## Enforcement

<How this rule is enforced — hook script path, instinct id, manual review at PR.>
```

#### Template — AGENT

Path: `.claude/agents/<name>.md`

```markdown
---
name: <name>
description: <one sentence: what role this agent plays + when to spawn (≤ 200 chars)>
model: <opus | sonnet | haiku>
tools: <comma-separated tool list, or "all">
---

# Agent: <Title>

## Role

<One paragraph: what this agent specializes in and why a separate context window
is justified versus doing the work inline.>

## When to spawn

<Triggers — usually a parent agent's task type or KICKOFF chunk type.>

## Inputs

- <Brief / spec / file paths the parent provides>

## Outputs

- <What this agent returns to the parent — format + delivery channel>

## Constraints

- <What this agent may NOT do>
- <Token / time budget>
- <Hand-off contract on completion>
```

#### Template — CONSTRAINT

Path: `.claude/constraints/<name>.md`

```markdown
---
name: <name>
description: <one sentence: the hard limit + what it protects (≤ 200 chars)>
type: <budget | scope | safety | security>
severity: <warning | error | hard-fail>
---

# Constraint: <Title>

## The limit

<Stated as a numeric or boolean condition.>

## What this protects

<2-3 sentences on what would go wrong without this constraint.>

## How to check

<A specific predicate an agent or hook can evaluate.>

## What to do when violated

- <Step 1: usually halt + escalate>
- <Step 2: report to operator>
```

### Step 3 — Validate

Run this checklist visibly. **Every box must be ticked** before Step 4.

- [ ] Frontmatter has `name` (kebab-case, ≤ 60 chars)
- [ ] Frontmatter has `description` (≤ 200 chars, specific not generic)
- [ ] Body sections from the template are present
- [ ] No `<placeholder>` strings remain
- [ ] Concrete example present (skill / rule / agent only)
- [ ] File path matches the template's prescribed location
- [ ] No secrets, no PII, no absolute paths to user folders
- [ ] If TYPE = rule with `enforcement: hook`, the hook script path exists
- [ ] If TYPE = agent, the model + tools list is realistic for the role

### Step 4 — Register

For project-local artifacts, run:

```bash
node build.mjs --project .
```

This re-scans the catalog and writes `data.json`. Verify the new artifact appears:

```bash
node query.mjs --type <skill|rule|agent|constraint> --source project
```

Your new artifact must be in the output. If not — file path is wrong, frontmatter is malformed, or build.mjs needs a flag (check for `--rules`/`--agents`/`--constraints`).

For global promotion (later, after the artifact has proven itself), copy to:
- `~/.claude/skills/<name>/` for skills
- `~/.claude/rules/<name>.md` for rules (if supported by your env)
- `~/.claude/agents/<name>.md` for agents

### Step 5 — Cite the new artifact in Phase 0.2 retroactively

Re-open the KICKOFF that triggered this. Update the Phase 0.2 skill-scan from
**partial / miss** to **perfect-fit**, listing the new artifact's slug. Then sign
0.6 again with a fresh timestamp.

The agent that triggered skill-development now resumes its original task —
**but only after Step 4 confirms registration**. Do not start the original task
in parallel. The contract requires the new artifact to exist before work proceeds.

---

## Validation: did this skill itself work?

The skill is being executed correctly when:

1. The agent visibly produced a `[GAP CONTRACT]` block before any Edit/Write
2. The agent picked exactly one TYPE and stuck with it
3. The new artifact validates and appears in the catalog
4. Phase 0.2 in the triggering KICKOFF was updated retroactively
5. The original task resumed only after Step 4 completed

If any of these is missing, the skill was performed (gone through the motions)
not executed (delivered the contract). Re-read the rules and try again.

---

## Failure modes

**The agent invents a hybrid type** ("it's kind of a rule but also a skill"):
→ REJECT. Pick one. If genuinely both, create both as separate artifacts.

**The artifact is generic** ("review code for quality"):
→ REJECT. Specific to the gap or do not create it. The catalog already has
generic items — adding more lowers signal.

**The agent skips Step 4 because "I know it works"**:
→ REJECT. Until `query.mjs` shows the artifact, it does not exist for any
other agent. Registration is the entire point.

**The agent creates the artifact AFTER the original task is done**:
→ REJECT. The whole contract is that the artifact gates the work, not the
other way around. Reverse the order on the next chunk.

---

## Provenance

This skill is the executable form of Phase 0.3 ("Skill-first fallback") in
`frameworks/COMPOUND.md`-derived KICKOFFs. It exists because rules without
escape valves get violated; explicit escape valves get followed.
